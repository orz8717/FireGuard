/**
 * Google Apps Script Backend - FireGuard Israel (v9.0)
 * פתרון סופי ומקיף: חתימות, טקסט גמיש, שמות שדות, שם קובץ דינמי ויחסי Parent-Child.
 */

function doPost(e) {
  console.log("--- START REQUEST ---");
  try {
    if (!e || !e.postData || !e.postData.contents) {
      console.error("Error: No data received.");
      return createJsonResponse({ status: 'error', message: 'No data received' });
    }
    var data = JSON.parse(e.postData.contents);
    console.log("Action: " + (data.action || "Automation Execution"));

    if (data.action === 'generate_template') {
      return handleGenerateTemplate(data);
    }
    return handleAutomationExecution(data);
  } catch (err) {
    console.error("TOP LEVEL ERROR: " + err.toString());
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * יצירת שבלונה עם תמיכה בטבלאות מקושרות (Parent-Child)
 */
function handleGenerateTemplate(data) {
  var tableName = data.tableName || "Parent_Table";
  var columns = data.columns || [];
  var linkedTables = data.linkedTables || []; // Array of { tableName, columns }

  var doc = DocumentApp.create("Template for " + tableName);
  var body = doc.getBody();

  // Parent Section
  body.appendParagraph("FireGuard Israel - Automation Template").setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph("Parent Table: " + tableName).setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendHorizontalRule();
  body.appendParagraph("Parent Placeholders:").setBold(true);
  columns.forEach(function(col) { body.appendParagraph("<<[" + col + "]>>"); });

  // Child Sections (Repeating Blocks)
  linkedTables.forEach(function(lt) {
    body.appendHorizontalRule();
    body.appendParagraph("<<Start:" + lt.tableName + ">>").setBold(true).setForegroundColor('#cc0000');
    
    var table = body.appendTable();
    var headerRow = table.appendTableRow();
    lt.columns.forEach(function(col) {
      headerRow.appendTableCell(col).setBackgroundColor('#f3f3f3').getChild(0).asParagraph().setBold(true);
    });
    
    var dataRow = table.appendTableRow();
    lt.columns.forEach(function(col) {
      dataRow.appendTableCell("<<[" + col + "]>>");
    });
    
    body.appendParagraph("<<End>>").setBold(true).setForegroundColor('#cc0000');
  });

  doc.saveAndClose();
  return createJsonResponse({ status: 'success', fileId: doc.getId(), fileUrl: DriveApp.getFileById(doc.getId()).getUrl() });
}

/**
 * הרצת אוטומציה עם תמיכה בשכפול שורות דינמי
 */
function handleAutomationExecution(data) {
  var task = data.task || {};
  var rowData = data.rowData || {};
  var childData = data.childData || {}; // { "TableName": [ {col: val}, ... ] }
  
  var templateId = task.googleDocTemplateId || data.templateId;
  var rawSubject = task.subject || data.subject || "FireGuard Report";
  var rawBody = task.body || data.body || "";
  var rawRecipients = task.to || data.recipients || "";
  var rawAttachmentName = task.attachmentName || data.attachmentName || "";
  var attachPdf = (task.attachment === true || data.attachPdf === true);

  if (!templateId) throw new Error("Missing Template ID");

  var parentRowId = rowData.ROWID || rowData.id || rowData.inspectionSerialNumber;

  var templateFile = DriveApp.getFileById(templateId);
  var tempFile = templateFile.makeCopy('Report_' + new Date().getTime());
  var tempDoc = DocumentApp.openById(tempFile.getId());
  var body = tempDoc.getBody();

  // 1. Process Dynamic Blocks (Child Tables)
  processDynamicBlocks(body, childData, parentRowId);

  // 2. Merge Parent Data
  mergeData(body, rowData);
  
  tempDoc.saveAndClose();

  var subject = fillPlaceholders(rawSubject, rowData);
  var bodyText = fillPlaceholders(rawBody, rowData);
  var recipientsStr = fillPlaceholders(rawRecipients, rowData);
  var attachmentName = fillPlaceholders(rawAttachmentName, rowData);

  var attachments = [];
  if (attachPdf) {
    var pdfBlob = DriveApp.getFileById(tempFile.getId()).getBlob().getAs('application/pdf');
    var finalFileName = attachmentName ? attachmentName : templateFile.getName() + ".pdf";
    if (finalFileName.toLowerCase().indexOf(".pdf") === -1) finalFileName += ".pdf";
    pdfBlob.setName(finalFileName);
    attachments.push(pdfBlob);
  }

  var recipientList = recipientsStr.split(',').map(function(email) { return email.trim(); });
  recipientList.forEach(function(email) {
    if (email && email.indexOf('@') > -1) {
      try {
        GmailApp.sendEmail(email, subject, bodyText, { attachments: attachments });
      } catch (e) {
        console.error("Send failed for " + email + ": " + e.toString());
      }
    }
  });

  DriveApp.getFileById(tempFile.getId()).setTrashed(true);
  return createJsonResponse({ status: 'success' });
}

/**
 * סורק את המסמך לבלוקים של Start/End ומשכפל תוכן
 */
function processDynamicBlocks(body, childData, parentRowId) {
  var startRegex = "<<Start:([^>]+)>>";
  var endMarker = "<<End>>";
  
  var startFound = body.findText(startRegex);
  
  while (startFound) {
    var startElement = startFound.getElement();
    var startText = startElement.asText().getText();
    var tableNameMatch = startText.match(/<<Start:([^>]+)>>/);
    if (!tableNameMatch) {
        startFound = body.findText(startRegex, startFound);
        continue;
    }
    var tableName = tableNameMatch[1].trim();
    
    var endFound = body.findText(endMarker, startFound);
    if (!endFound) break;

    var rows = childData[tableName] || [];
    
    // TASK 3: Flexible Join Logic
    if (rows.length > 0 && parentRowId) {
      rows = rows.filter(function(row) {
        var refKeys = ['ROWID'];
        for (var i = 0; i < refKeys.length; i++) {
          if (row[refKeys[i]] && String(row[refKeys[i]]).trim() === String(parentRowId).trim()) {
            return true;
          }
        }
        return false;
      });
    }
    
    if (rows.length === 0) {
      removeContentBetween(body, startFound, endFound);
    } else {
      duplicateAndFill(body, startFound, endFound, rows);
    }
    
    startFound = body.findText(startRegex);
  }
}

/**
 * משכפל את התוכן שבין התגיות עבור כל שורה בנתונים
 */
function duplicateAndFill(body, startRange, endRange, rows) {
  var startElement = startRange.getElement();
  var endElement = endRange.getElement();
  
  var parent = startElement.getParent();
  var startIndex = parent.getChildIndex(startElement);
  var endIndex = parent.getChildIndex(endElement);
  
  // זיהוי האלמנטים לשכפול
  var elementsToCopy = [];
  for (var i = startIndex + 1; i < endIndex; i++) {
    elementsToCopy.push(parent.getChild(i).copy());
  }
  
  var insertionIndex = endIndex;
  rows.forEach(function(rowData) {
    elementsToCopy.forEach(function(el) {
      var newEl = el.copy();
      var inserted;
      if (newEl.getType() == DocumentApp.ElementType.TABLE) {
        inserted = parent.insertTable(insertionIndex, newEl.asTable());
      } else if (newEl.getType() == DocumentApp.ElementType.PARAGRAPH) {
        inserted = parent.insertParagraph(insertionIndex, newEl.asParagraph());
      } else if (newEl.getType() == DocumentApp.ElementType.LIST_ITEM) {
        inserted = parent.insertListItem(insertionIndex, newEl.asListItem());
      }
      
      if (inserted) {
        mergeData(inserted, rowData);
        insertionIndex++;
      }
    });
  });
  
  // הסרת הבלוק המקורי והתגיות
  for (var i = endIndex; i >= startIndex; i--) {
    parent.removeChild(parent.getChild(i));
  }
}

function removeContentBetween(body, startRange, endRange) {
  var startElement = startRange.getElement();
  var endElement = endRange.getElement();
  var parent = startElement.getParent();
  var startIndex = parent.getChildIndex(startElement);
  var endIndex = parent.getChildIndex(endElement);
  
  for (var i = endIndex; i >= startIndex; i--) {
    parent.removeChild(parent.getChild(i));
  }
}

function mergeData(container, data) {
  for (var key in data) {
    var value = data[key];
    if (value === null || value === undefined) value = "";
    
    var isSignatureField = key.toLowerCase().includes("חתימה") || key.toLowerCase().includes("signature");
    var isImageData = typeof value === 'string' && (value.indexOf("data:image/") === 0 || (value.length > 500 && !value.includes(" ")));

    if (isSignatureField || isImageData) {
      processFlexibleImagePlaceholder(container, key, value);
    } else {
      replaceTextFlexibly(container, key, String(value));
    }
  }
}

function fillPlaceholders(text, data) {
  if (!text) return "";
  return text.replace(/<{2,3}\[?([^\]>|\n]+)\]?([>|<]{2,3})/g, function(match, key) {
    var cleanKey = key.trim();
    var val = findValueInRowData(cleanKey, data);
    if (val !== undefined) {
      if (typeof val === 'string' && (val.indexOf('data:image/') === 0 || val.length > 1000)) return "[חתימה]";
      return (val === null) ? "" : String(val);
    }
    return match;
  });
}

function findValueInRowData(key, data) {
  if (data.hasOwnProperty(key)) return data[key];
  var normalizedKey = key.replace(/_/g, ' ').trim();
  for (var k in data) {
    if (k.replace(/_/g, ' ').trim() === normalizedKey) return data[k];
  }
  return undefined;
}

function processFlexibleImagePlaceholder(container, key, base64Data) {
  var escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // רגקס גמיש שתופס <<[שדה]>>, <<שדה>>, <<<[שדה]>>> וגם סגירות לא עקביות כמו <<[שדה]<<
  var placeholderRegex = "<{2,3}\\[?" + escapedKey + "\\]?[>|<]{2,3}";
  
  var rangeElement = container.findText(placeholderRegex);
  
  while (rangeElement) {
    try {
      var element = rangeElement.getElement();
      var base64String = base64Data.indexOf(',') > -1 ? base64Data.split(',')[1] : base64Data;
      var contentType = base64Data.indexOf(',') > -1 ? base64Data.split(',')[0].split(':')[1].split(';')[0] : "image/png";
      var decodedData = Utilities.base64Decode(base64String);
      var blob = Utilities.newBlob(decodedData, contentType);

      var image = null;
      var parent = element.getParent();
      
      if (parent.getType() === DocumentApp.ElementType.PARAGRAPH) {
        var index = parent.getChildIndex(element);
        image = parent.asParagraph().insertInlineImage(index, blob);
      } else if (parent.getType() === DocumentApp.ElementType.TABLE_CELL) {
        image = parent.asTableCell().appendImage(blob);
      }

      if (image) {
        var maxWidth = 150;
        var ratio = image.getWidth() / image.getHeight();
        image.setWidth(maxWidth);
        image.setHeight(maxWidth / ratio);
      }

      element.asText().deleteText(rangeElement.getStartOffset(), rangeElement.getEndOffsetInclusive());
      rangeElement = container.findText(placeholderRegex, rangeElement);
    } catch (e) {
      console.error("Image error: " + e.toString());
      break;
    }
  }
}

function replaceTextFlexibly(container, key, value) {
  var escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var patterns = [
    '<<\\[' + escapedKey + '\\]>>',
    '<<' + escapedKey + '>>',
    '<<<\\[' + escapedKey + '\\]>>>',
    '<<\\[' + escapedKey + '\\]<<'
  ];
  
  patterns.forEach(function(pattern) {
    try {
      container.replaceText(pattern, value);
    } catch (e) {}
  });
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
