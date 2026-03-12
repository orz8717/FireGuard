/**
 * Google Apps Script for FireGuard Israel Automation Engine
 * This script handles:
 * 1. Template Generation (Auto-creating Google Docs with placeholders)
 * 2. Document Injection (1:1 Search & Replace with Image/Signature support)
 * 3. PDF Conversion & Email Delivery
 */

function doPost(e) {
  var logs = [];
  try {
    var payload = JSON.parse(e.postData.contents);
    logs.push("Payload received: " + JSON.stringify(payload).substring(0, 200) + "...");

    // 1. Handle Template Generation Request
    if (payload.action === 'generate_template') {
      return ContentService.createTextOutput(JSON.stringify(generateTemplate(payload)))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Handle Automation Task (Email/PDF)
    var result = processAutomation(payload, logs);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString(),
      logs: logs
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Generates a new Google Doc template with all placeholders from the database schema.
 * Follows Strict Format: <<field_name>> (No square brackets, no extra characters).
 */
function generateTemplate(payload) {
  var doc = DocumentApp.create('שבלונה - ' + payload.tableName);
  var body = doc.getBody();
  
  // Set document to RTL direction if possible (Hebrew support)
  // Note: DocumentApp doesn't have a global RTL setting, but we set paragraph alignment.
  
  body.appendParagraph('שבלונה אוטומטית עבור טבלה: ' + payload.tableName)
      .setHeading(DocumentApp.ParagraphHeading.HEADING1)
      .setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  
  body.appendParagraph('הוראות:').setHeading(DocumentApp.ParagraphHeading.HEADING2).setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  body.appendParagraph('1. עצב את המסמך כרצונך.').setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  body.appendParagraph('2. השאר את השדות בתוך סוגריים כפולים <<שם_עמודה>>.').setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  body.appendParagraph('3. עבור חתימות או תמונות, השתמש בשם העמודה המתאים (למשל <<technician_signature>>).').setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  body.appendParagraph('4. עבור טבלאות ציוד (Child), השתמש באינדקסים: <<שם_עמודה_1>>, <<שם_עמודה_2>> וכו\'.').setAlignment(DocumentApp.HorizontalAlignment.RIGHT);

  body.appendParagraph('שדות ראשיים (Parent):').setHeading(DocumentApp.ParagraphHeading.HEADING2).setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  payload.columns.forEach(function(col) {
    // Strict Format: Remove any brackets or extra chars from column name
    var cleanCol = col.replace(/[\[\]<>]/g, '');
    var placeholder = '<<' + cleanCol + '>>';
    // RTL Sanity: Insert as single continuous string
    body.appendParagraph(placeholder).setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  });
  
  if (payload.linkedTables && payload.linkedTables.length > 0) {
    payload.linkedTables.forEach(function(lt) {
      body.appendParagraph('טבלה מקושרת: ' + lt.tableName).setHeading(DocumentApp.ParagraphHeading.HEADING2).setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
      
      // Generate sample indexed placeholders (Rows 1-3) to match flattenData output
      for (var i = 1; i <= 3; i++) {
        body.appendParagraph('שורה ' + i + ':').setBold(true).setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
        lt.columns.forEach(function(col) {
          var cleanCol = col.replace(/[\[\]<>]/g, '');
          var placeholder = '<<' + cleanCol + '_' + i + '>>';
          body.appendParagraph(placeholder).setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
        });
        body.appendParagraph('').setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
      }
      body.appendParagraph('... המשך עד 150 שורות לפי הצורך ...').setItalic(true).setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
    });
  }
  
  return { status: 'success', docId: doc.getId(), url: doc.getUrl() };
}

/**
 * Main automation logic: Search & Replace + PDF + Email
 */
function processAutomation(payload, logs) {
  var task = payload.task || {};
  var combinedData = payload.combinedData || {};
  var templateId = payload.templateId || task.googleDocTemplateId || task.templateId;

  if (!templateId) {
    throw new Error("Missing Google Doc Template ID");
  }

  logs.push("Opening template: " + templateId);
  var templateFile = DriveApp.getFileById(templateId);
  var fileName = 'דוח - ' + (combinedData.inspectionSerialNumber || combinedData.id || 'ביקורת');
  var tempFile = templateFile.makeCopy(fileName);
  var doc = DocumentApp.openById(tempFile.getId());
  
  var body = doc.getBody();
  var header = doc.getHeader();
  var footer = doc.getFooter();

  // 1:1 Global Replacement
  logs.push("Starting 1:1 replacement for " + Object.keys(combinedData).length + " fields");
  
  Object.entries(combinedData).forEach(function([key, value]) {
    // Strict Format: <<key>>
    var placeholder = '<<' + key + '>>';
    
    // Handle Images / Signatures (Base64)
    if (typeof value === 'string' && value.indexOf('data:image/') === 0) {
      logs.push("Injecting image for: " + key);
      injectImage(body, placeholder, value);
      if (header) injectImage(header, placeholder, value);
      if (footer) injectImage(footer, placeholder, value);
    } else {
      // Standard Text Replacement
      var safeValue = (value === null || value === undefined) ? "" : String(value);
      body.replaceText(placeholder, safeValue);
      if (header) header.replaceText(placeholder, safeValue);
      if (footer) footer.replaceText(placeholder, safeValue);
    }
  });

  doc.saveAndClose();
  logs.push("Document saved and closed.");

  // Convert to PDF
  var pdfBlob = tempFile.getAs(MimeType.PDF);
  pdfBlob.setName(fileName + '.pdf');

  // Handle File Storage
  if (task.filePath) {
    logs.push("Saving PDF to folder: " + task.filePath);
    try {
      var folder = getOrCreateFolder(task.filePath);
      folder.createFile(pdfBlob);
    } catch (e) {
      logs.push("Warning: Could not save to folder: " + e.toString());
    }
  }

  // Handle Email Delivery
  if (task.type === 'EMAIL' && task.to) {
    logs.push("Sending email to: " + task.to);
    var subject = task.subject || 'דוח ביקורת - ' + (combinedData.inspectionSerialNumber || '');
    var emailBody = task.body || 'מצורף דוח ביקורת.';
    
    // Replace placeholders in subject and body too
    Object.entries(combinedData).forEach(function([k, v]) {
      var p = '<<' + k + '>>';
      subject = subject.replace(new RegExp(p, 'g'), v);
      emailBody = emailBody.replace(new RegExp(p, 'g'), v);
    });

    var mailOptions = {
      name: 'FireGuard Israel Automation',
      attachments: [pdfBlob]
    };
    if (task.cc) mailOptions.cc = task.cc;
    if (task.bcc) mailOptions.bcc = task.bcc;

    MailApp.sendEmail(task.to, subject, emailBody, mailOptions);
    logs.push("Email sent successfully.");
  }

  // Cleanup
  tempFile.setTrashed(true);
  logs.push("Temporary file deleted.");

  return {
    status: 'success',
    message: 'Automation completed successfully',
    logs: logs
  };
}

/**
 * Injects an image into the document at the placeholder's location
 */
function injectImage(container, placeholder, base64Data) {
  var next = container.findText(placeholder);
  if (!next) return;

  try {
    var textElement = next.getElement();
    var offset = next.getStartOffset();
    
    // Decode base64
    var contentType = base64Data.split(';')[0].split(':')[1];
    var bytes = Utilities.base64Decode(base64Data.split(',')[1]);
    var imageBlob = Utilities.newBlob(bytes, contentType);
    
    var parent = textElement.getParent();
    if (parent.getType() === DocumentApp.ElementType.PARAGRAPH) {
      var img = parent.asParagraph().insertInlineImage(offset, imageBlob);
      
      // Maintain reasonable dimensions (e.g., max width 200px for signatures)
      var width = img.getWidth();
      var height = img.getHeight();
      var ratio = width / height;
      
      if (width > 200) {
        img.setWidth(200);
        img.setHeight(200 / ratio);
      }

      // Remove the placeholder text
      textElement.asText().deleteText(offset, offset + placeholder.length - 1);
    }
  } catch (e) {
    container.replaceText(placeholder, "[Error Injecting Image]");
  }
}

/**
 * Helper to find or create a folder path in Drive
 */
function getOrCreateFolder(path) {
  var parts = path.split('/').filter(function(p) { return p.length > 0; });
  var folder = DriveApp.getRootFolder();
  for (var i = 0; i < parts.length; i++) {
    var subFolders = folder.getFoldersByName(parts[i]);
    if (subFolders.hasNext()) {
      folder = subFolders.next();
    } else {
      folder = folder.createFolder(parts[i]);
    }
  }
  return folder;
}
