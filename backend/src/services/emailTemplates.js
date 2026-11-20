/**
 * CivicFix AI - Email Templates Module
 * 
 * Generates responsive, professionally branded HTML and plain-text emails.
 * All dynamic user-generated content is strictly HTML-escaped to prevent injection vulnerabilities.
 */

/**
 * Escapes unsafe characters in user-provided strings for safe HTML interpolation
 * @param {string} str
 * @returns {string}
 */
export const escapeHtml = (str) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Common HTML email shell wrapper with modern, responsive styling
 * @param {object} params
 * @param {string} params.title
 * @param {string} params.bodyHtml
 * @returns {string} Full HTML email
 */
const renderEmailShell = ({ title, bodyHtml }) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      line-height: 1.6;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 32px 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #1e3a8a, #2563eb);
      padding: 28px 32px;
      text-align: left;
    }
    .brand-title {
      color: #ffffff;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0;
    }
    .brand-badge {
      display: inline-block;
      background-color: rgba(255, 255, 255, 0.2);
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 2px 8px;
      border-radius: 9999px;
      margin-left: 8px;
      vertical-align: middle;
    }
    .content {
      padding: 32px;
    }
    .ticket-badge {
      display: inline-block;
      background-color: #f1f5f9;
      color: #0f172a;
      font-family: monospace;
      font-size: 15px;
      font-weight: 700;
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      margin: 8px 0 16px 0;
    }
    .detail-card {
      background-color: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      padding: 16px 20px;
      margin: 20px 0;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 14px;
    }
    .detail-row:last-child {
      margin-bottom: 0;
    }
    .detail-label {
      color: #64748b;
      font-weight: 500;
    }
    .detail-value {
      color: #0f172a;
      font-weight: 600;
      text-align: right;
    }
    .btn-cta {
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      padding: 12px 24px;
      border-radius: 6px;
      margin: 24px 0 12px 0;
    }
    .footer {
      background-color: #f8fafc;
      padding: 24px 32px;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #94a3b8;
      text-align: center;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1 class="brand-title">CivicFix<span class="brand-badge">AI</span></h1>
      </div>
      <div class="content">
        ${bodyHtml}
      </div>
      <div class="footer">
        <p>This is an automated municipal notification from CivicFix AI Smart Public Issue Reporting System.</p>
        <p>Please do not reply directly to this email. For updates, please use the official ticket tracking link.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
};

// -----------------------------------------------------------------------------
// 1. COMPLAINT SUBMISSION CONFIRMATION
// -----------------------------------------------------------------------------
export const renderComplaintSubmissionEmail = ({
  complaintId,
  title,
  category,
  submissionDate,
  trackingUrl
}) => {
  const safeId = escapeHtml(complaintId);
  const safeTitle = escapeHtml(title);
  const safeCategory = escapeHtml(category);
  const formattedDate = submissionDate ? new Date(submissionDate).toLocaleString() : new Date().toLocaleString();

  const subject = `[CivicFix AI] Complaint Submitted: #${complaintId}`;

  const bodyHtml = `
    <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">Complaint Successfully Registered</h2>
    <p>Thank you for contributing to your city's infrastructure. Your public hazard report has been recorded in the municipal queue and assigned a tracking identifier:</p>
    
    <div class="ticket-badge">Ticket: #${safeId}</div>

    <div class="detail-card">
      <div class="detail-row">
        <span class="detail-label">Issue Title:</span>
        <span class="detail-value">${safeTitle}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Category:</span>
        <span class="detail-value">${safeCategory}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Initial Status:</span>
        <span class="detail-value" style="color: #d97706;">Pending</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Submitted On:</span>
        <span class="detail-value">${escapeHtml(formattedDate)}</span>
      </div>
    </div>

    <p>You can track the ongoing investigation, automated AI triage, department routing, and field resolution status live using the button below:</p>

    <div style="text-align: center;">
      <a href="${escapeHtml(trackingUrl)}" class="btn-cta" target="_blank" rel="noopener noreferrer">
        Track Complaint Status &rarr;
      </a>
    </div>

    <p style="font-size: 13px; color: #64748b;">Direct Tracking Link: <a href="${escapeHtml(trackingUrl)}" style="color: #2563eb;">${escapeHtml(trackingUrl)}</a></p>
  `;

  const text = `CivicFix AI - Complaint Successfully Registered

Ticket ID: #${complaintId}
Title: ${title}
Category: ${category}
Initial Status: Pending
Submitted On: ${formattedDate}

You can track your issue resolution pipeline online at:
${trackingUrl}

Thank you for reporting this issue.
-- CivicFix AI Municipal System`;

  return {
    subject,
    html: renderEmailShell({ title: subject, bodyHtml }),
    text
  };
};

// -----------------------------------------------------------------------------
// 2. COMPLAINT STATUS UPDATE
// -----------------------------------------------------------------------------
export const renderComplaintStatusUpdateEmail = ({
  complaintId,
  title,
  previousStatus,
  newStatus,
  note,
  updateDate,
  trackingUrl
}) => {
  const safeId = escapeHtml(complaintId);
  const safeTitle = escapeHtml(title);
  const safePrev = escapeHtml(previousStatus);
  const safeNew = escapeHtml(newStatus);
  const safeNote = note ? escapeHtml(note) : '';
  const formattedDate = updateDate ? new Date(updateDate).toLocaleString() : new Date().toLocaleString();

  const subject = `[CivicFix AI] Status Updated: #${complaintId} is now ${newStatus}`;

  const bodyHtml = `
    <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">Complaint Status Update</h2>
    <p>The municipal workflow for your reported civic hazard has been updated:</p>
    
    <div class="ticket-badge">Ticket: #${safeId}</div>

    <div class="detail-card">
      <div class="detail-row">
        <span class="detail-label">Issue Title:</span>
        <span class="detail-value">${safeTitle}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Previous Status:</span>
        <span class="detail-value">${safePrev}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Current Status:</span>
        <span class="detail-value" style="color: #2563eb;">${safeNew}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Updated On:</span>
        <span class="detail-value">${escapeHtml(formattedDate)}</span>
      </div>
      ${
        safeNote
          ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
               <span class="detail-label">Progress Note:</span>
               <p style="margin: 4px 0 0 0; color: #1e293b; font-style: italic;">"${safeNote}"</p>
             </div>`
          : ''
      }
    </div>

    <div style="text-align: center;">
      <a href="${escapeHtml(trackingUrl)}" class="btn-cta" target="_blank" rel="noopener noreferrer">
        View Resolution Details &rarr;
      </a>
    </div>

    <p style="font-size: 13px; color: #64748b;">Direct Tracking Link: <a href="${escapeHtml(trackingUrl)}" style="color: #2563eb;">${escapeHtml(trackingUrl)}</a></p>
  `;

  const text = `CivicFix AI - Complaint Status Update

Ticket ID: #${complaintId}
Title: ${title}
Status Changed: ${previousStatus} -> ${newStatus}
Updated On: ${formattedDate}
${note ? `Note: "${note}"\n` : ''}
Track live progress at:
${trackingUrl}

-- CivicFix AI Municipal System`;

  return {
    subject,
    html: renderEmailShell({ title: subject, bodyHtml }),
    text
  };
};

// -----------------------------------------------------------------------------
// 3. DEPARTMENT ASSIGNMENT NOTIFICATION
// -----------------------------------------------------------------------------
export const renderDepartmentAssignmentEmail = ({
  complaintId,
  title,
  departmentName,
  trackingUrl
}) => {
  const safeId = escapeHtml(complaintId);
  const safeTitle = escapeHtml(title);
  const safeDept = escapeHtml(departmentName);

  const subject = `[CivicFix AI] Dispatched to Department: #${complaintId}`;

  const bodyHtml = `
    <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">Assigned to Municipal Department</h2>
    <p>Your reported issue has been triaged and routed to the responsible department for field action:</p>
    
    <div class="ticket-badge">Ticket: #${safeId}</div>

    <div class="detail-card">
      <div class="detail-row">
        <span class="detail-label">Issue Title:</span>
        <span class="detail-value">${safeTitle}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Assigned Department:</span>
        <span class="detail-value" style="color: #1e40af;">${safeDept}</span>
      </div>
    </div>

    <p>Field officers in this department have been notified to inspect the location and schedule necessary repairs.</p>

    <div style="text-align: center;">
      <a href="${escapeHtml(trackingUrl)}" class="btn-cta" target="_blank" rel="noopener noreferrer">
        Track Assignment &rarr;
      </a>
    </div>
  `;

  const text = `CivicFix AI - Assigned to Municipal Department

Ticket ID: #${complaintId}
Title: ${title}
Assigned Department: ${departmentName}

Track ongoing updates at:
${trackingUrl}

-- CivicFix AI Municipal System`;

  return {
    subject,
    html: renderEmailShell({ title: subject, bodyHtml }),
    text
  };
};

// -----------------------------------------------------------------------------
// 4. OFFICER ASSIGNMENT NOTIFICATION (INTERNAL OFFICER OPERATIONAL ALERT)
// -----------------------------------------------------------------------------
export const renderOfficerAssignmentEmail = ({
  complaintId,
  title,
  departmentName,
  officerName,
  note,
  dashboardUrl
}) => {
  const safeId = escapeHtml(complaintId);
  const safeTitle = escapeHtml(title);
  const safeDept = escapeHtml(departmentName);
  const safeOfficer = escapeHtml(officerName);
  const safeNote = note ? escapeHtml(note) : '';

  const subject = `[CivicFix AI Dispatch] New Work Order Assigned: #${complaintId}`;

  const bodyHtml = `
    <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">Work Order Assigned to You</h2>
    <p>Hello <strong>${safeOfficer}</strong>, a public hazard complaint has been assigned to your field dispatch queue:</p>
    
    <div class="ticket-badge">Ticket: #${safeId}</div>

    <div class="detail-card">
      <div class="detail-row">
        <span class="detail-label">Complaint Title:</span>
        <span class="detail-value">${safeTitle}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Department:</span>
        <span class="detail-value">${safeDept}</span>
      </div>
      ${
        safeNote
          ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
               <span class="detail-label">Dispatcher Instructions:</span>
               <p style="margin: 4px 0 0 0; color: #1e293b; font-style: italic;">"${safeNote}"</p>
             </div>`
          : ''
      }
    </div>

    <p>Please log in to your field officer portal to inspect incident GPS coordinates, photos, and update on-site resolution status.</p>

    <div style="text-align: center;">
      <a href="${escapeHtml(dashboardUrl)}" class="btn-cta" target="_blank" rel="noopener noreferrer">
        Open Field Officer Portal &rarr;
      </a>
    </div>
  `;

  const text = `CivicFix AI - Field Dispatch Work Order

Hello ${officerName},
A complaint has been assigned to your field queue:

Ticket ID: #${complaintId}
Title: ${title}
Department: ${departmentName}
${note ? `Instructions: "${note}"\n` : ''}
Open your officer dashboard to review details and begin field work:
${dashboardUrl}

-- CivicFix AI Municipal Operations`;

  return {
    subject,
    html: renderEmailShell({ title: subject, bodyHtml }),
    text
  };
};

// -----------------------------------------------------------------------------
// 5. COMPLAINT RESOLUTION NOTIFICATION
// -----------------------------------------------------------------------------
export const renderComplaintResolutionEmail = ({
  complaintId,
  title,
  resolutionDate,
  note,
  trackingUrl
}) => {
  const safeId = escapeHtml(complaintId);
  const safeTitle = escapeHtml(title);
  const safeNote = note ? escapeHtml(note) : '';
  const formattedDate = resolutionDate ? new Date(resolutionDate).toLocaleString() : new Date().toLocaleString();

  const subject = `[CivicFix AI] Issue Resolved: #${complaintId}`;

  const bodyHtml = `
    <h2 style="margin-top: 0; color: #047857; font-size: 20px;">✓ Public Hazard Resolved</h2>
    <p>Good news! Municipal crews have successfully addressed and resolved your reported issue:</p>
    
    <div class="ticket-badge" style="background-color: #ecfdf5; border-color: #a7f3d0; color: #065f46;">
      Resolved: #${safeId}
    </div>

    <div class="detail-card">
      <div class="detail-row">
        <span class="detail-label">Issue Title:</span>
        <span class="detail-value">${safeTitle}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Final Status:</span>
        <span class="detail-value" style="color: #059669; font-weight: 700;">Resolved</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Resolved On:</span>
        <span class="detail-value">${escapeHtml(formattedDate)}</span>
      </div>
      ${
        safeNote
          ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
               <span class="detail-label">Resolution Summary:</span>
               <p style="margin: 4px 0 0 0; color: #1e293b; font-style: italic;">"${safeNote}"</p>
             </div>`
          : ''
      }
    </div>

    <p>Thank you for active civic participation and helping keep our community safe and functional.</p>

    <div style="text-align: center;">
      <a href="${escapeHtml(trackingUrl)}" class="btn-cta" style="background-color: #059669;" target="_blank" rel="noopener noreferrer">
        View Resolution Record &rarr;
      </a>
    </div>
  `;

  const text = `CivicFix AI - Issue Resolved

Ticket ID: #${complaintId}
Title: ${title}
Status: Resolved
Resolved On: ${formattedDate}
${note ? `Resolution Note: "${note}"\n` : ''}
Review the completed resolution record at:
${trackingUrl}

Thank you for reporting this issue.
-- CivicFix AI Municipal System`;

  return {
    subject,
    html: renderEmailShell({ title: subject, bodyHtml }),
    text
  };
};

/**
 * Renders an SLA Warning Alert email when a complaint is approaching its deadline
 * @param {object} params
 * @param {object} params.complaint
 * @param {number} params.remainingHours
 * @param {string} params.portalUrl
 * @returns {{subject: string, html: string, text: string}}
 */
export const renderSlaWarningEmail = ({ complaint, remainingHours, portalUrl }) => {
  const complaintId = complaint.complaintId || 'N/A';
  const title = complaint.title || 'Untitled Issue';
  const subject = `⚠️ SLA Warning: Complaint #${complaintId} approaching deadline (${remainingHours}h remaining)`;

  const bodyHtml = `
    <h2>⚠️ SLA Resolution Deadline Approaching</h2>
    <p>This automated notice informs you that a municipal complaint assigned to your department is approaching its SLA deadline.</p>

    <div class="card-details" style="border-left: 4px solid #f59e0b;">
      <div class="detail-row">
        <span class="detail-label">Ticket ID:</span>
        <span class="detail-value">#${escapeHtml(complaintId)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Issue:</span>
        <span class="detail-value">${escapeHtml(title)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Category:</span>
        <span class="detail-value">${escapeHtml(complaint.category || 'General')}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Remaining Time:</span>
        <span class="detail-value" style="color: #d97706; font-weight: bold;">${escapeHtml(remainingHours)} hours</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Deadline:</span>
        <span class="detail-value">${complaint.sla?.deadline ? new Date(complaint.sla.deadline).toLocaleString() : 'N/A'}</span>
      </div>
    </div>

    <p>Please review and expedite field inspection or resolution to avoid escalation.</p>

    <div style="text-align: center;">
      <a href="${escapeHtml(portalUrl)}" class="btn-cta" style="background-color: #d97706;" target="_blank" rel="noopener noreferrer">
        Open Operations Workspace &rarr;
      </a>
    </div>
  `;

  const text = `SLA Warning: Complaint #${complaintId} approaching deadline
Title: ${title}
Remaining Time: ${remainingHours} hours
Please take action to complete resolution.
Access portal: ${portalUrl}`;

  return {
    subject,
    html: renderEmailShell({ title: subject, bodyHtml }),
    text
  };
};

/**
 * Renders an SLA Breach Alert email when a complaint deadline is missed
 * @param {object} params
 * @param {object} params.complaint
 * @param {number} params.overdueHours
 * @param {string} params.portalUrl
 * @returns {{subject: string, html: string, text: string}}
 */
export const renderSlaBreachEmail = ({ complaint, overdueHours, portalUrl }) => {
  const complaintId = complaint.complaintId || 'N/A';
  const title = complaint.title || 'Untitled Issue';
  const subject = `🚨 SLA Breach: Complaint #${complaintId} is OVERDUE by ${overdueHours}h`;

  const bodyHtml = `
    <h2>🚨 SLA Target Breached (Level 2 Escalation)</h2>
    <p>A civic complaint has passed its agreed municipal resolution deadline and has been escalated to department leadership.</p>

    <div class="card-details" style="border-left: 4px solid #ef4444;">
      <div class="detail-row">
        <span class="detail-label">Ticket ID:</span>
        <span class="detail-value">#${escapeHtml(complaintId)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Issue:</span>
        <span class="detail-value">${escapeHtml(title)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Department:</span>
        <span class="detail-value">${escapeHtml(complaint.assignedDepartment?.name || complaint.assignedDepartmentName || 'Unassigned')}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Overdue Duration:</span>
        <span class="detail-value" style="color: #dc2626; font-weight: bold;">${escapeHtml(overdueHours)} hours past deadline</span>
      </div>
    </div>

    <p>Immediate supervisory intervention is required to complete field work and update incident status.</p>

    <div style="text-align: center;">
      <a href="${escapeHtml(portalUrl)}" class="btn-cta" style="background-color: #dc2626;" target="_blank" rel="noopener noreferrer">
        Review Escalated Ticket &rarr;
      </a>
    </div>
  `;

  const text = `SLA Breach: Complaint #${complaintId} is OVERDUE by ${overdueHours} hours.
Immediate supervisory intervention required.
Access portal: ${portalUrl}`;

  return {
    subject,
    html: renderEmailShell({ title: subject, bodyHtml }),
    text
  };
};

/**
 * Renders a Critical Escalation Alert email (Level 3 or Manual Administrative Escalation)
 * @param {object} params
 * @param {object} params.complaint
 * @param {number} params.escalationLevel
 * @param {string} params.reason
 * @param {string} params.portalUrl
 * @returns {{subject: string, html: string, text: string}}
 */
export const renderSlaEscalationEmail = ({ complaint, escalationLevel, reason, portalUrl }) => {
  const complaintId = complaint.complaintId || 'N/A';
  const title = complaint.title || 'Untitled Issue';
  const subject = `🔥 [CRITICAL ESCALATION Level ${escalationLevel}] Complaint #${complaintId}`;

  const bodyHtml = `
    <h2>🔥 High-Priority Incident Escalation (Level ${escapeHtml(escalationLevel)})</h2>
    <p>This complaint has crossed critical escalation criteria and has been brought directly to the attention of municipal administration.</p>

    <div class="card-details" style="border-left: 4px solid #b91c1c;">
      <div class="detail-row">
        <span class="detail-label">Ticket ID:</span>
        <span class="detail-value">#${escapeHtml(complaintId)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Escalation Level:</span>
        <span class="detail-value" style="color: #b91c1c; font-weight: bold;">Level ${escapeHtml(escalationLevel)} (Critical)</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Issue:</span>
        <span class="detail-value">${escapeHtml(title)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Justification / Reason:</span>
        <span class="detail-value">${escapeHtml(reason)}</span>
      </div>
    </div>

    <div style="text-align: center;">
      <a href="${escapeHtml(portalUrl)}" class="btn-cta" style="background-color: #b91c1c;" target="_blank" rel="noopener noreferrer">
        Admin Command Center &rarr;
      </a>
    </div>
  `;

  const text = `Critical Escalation Level ${escalationLevel}: Complaint #${complaintId}
Title: ${title}
Reason: ${reason}
Access admin command center: ${portalUrl}`;

  return {
    subject,
    html: renderEmailShell({ title: subject, bodyHtml }),
    text
  };
};

export default {
  escapeHtml,
  renderComplaintSubmissionEmail,
  renderComplaintStatusUpdateEmail,
  renderDepartmentAssignmentEmail,
  renderOfficerAssignmentEmail,
  renderComplaintResolutionEmail,
  renderSlaWarningEmail,
  renderSlaBreachEmail,
  renderSlaEscalationEmail
};
