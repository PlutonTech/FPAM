'use strict';
// ── FORM FIELD DEFINITIONS ────────────────────────────────────────────────────
// Single source of truth for what each of the 15 FormRequest types looks like
// on screen. Drives the dynamic form renderer used by both mda_portal.html
// (submission) and form_requests.html (FPAM review). Field `key` paths match
// FormRequest.js's embedded sub-schema field names exactly.
//
// Field types: text, textarea, date, number, select, checkbox, checkboxGroup,
// table (repeating rows — each row uses its own `columns` array)

const FORM_LABELS = {
  MAINTENANCE_COMPLIANCE_DECLARATION: 'Maintenance Compliance Declaration',
  ASSET_INVENTORY_DECLARATION:        'Asset Inventory Declaration',
  PREVENTIVE_MAINTENANCE_SCHEDULE:    'Preventive Maintenance Schedule Submission',
  MAINTENANCE_ACTIVITY_REPORT:        'Maintenance Activity Report',
  MAINTENANCE_INCIDENT_REPORT:        'Maintenance Incident Report',
  MAINTENANCE_WORK_ORDER:             'Maintenance Work Order',
  ASSET_CONDITION_ASSESSMENT:         'Asset Condition Assessment',
  SERVICE_PROVIDER_CERTIFICATION:     'Service Provider Certification Compliance',
  BUDGET_ALLOCATION_UTILIZATION:      'Facility Management Budget Allocation & Utilization',
  TRAINING_CAPACITY_BUILDING:         'Facility Management Training & Capacity Building Compliance',
  HSE_COMPLIANCE_CHECKLIST:           'Health, Safety & Environmental (HSE) Compliance Checklist',
  AUDIT_RESPONSE_CORRECTIVE_ACTION:   'Assets Audit Response & Corrective Action',
  CERTIFICATION_REQUEST:              'Certification Request Submission',
  EQUIPMENT_CALIBRATION_CERTIFICATE:  'Equipment Calibration / Inspection Certificate Submission',
  EQUIPMENT_DISPOSAL_DECOMMISSIONING: 'Equipment & Material Disposal / Decommissioning Compliance',
  SECURITY_SERVICES_COST_TEMPLATE:    'Security Services Cost Template',
  JANITORIAL_SERVICES_COST_TEMPLATE:  'Janitorial & Horticulture Services Cost Template',
};

const FORM_ICONS = {
  MAINTENANCE_COMPLIANCE_DECLARATION: 'fa-file-signature',
  ASSET_INVENTORY_DECLARATION:        'fa-boxes-stacked',
  PREVENTIVE_MAINTENANCE_SCHEDULE:    'fa-calendar-check',
  MAINTENANCE_ACTIVITY_REPORT:        'fa-clipboard-list',
  MAINTENANCE_INCIDENT_REPORT:        'fa-triangle-exclamation',
  MAINTENANCE_WORK_ORDER:             'fa-screwdriver-wrench',
  ASSET_CONDITION_ASSESSMENT:         'fa-magnifying-glass-chart',
  SERVICE_PROVIDER_CERTIFICATION:     'fa-user-shield',
  BUDGET_ALLOCATION_UTILIZATION:      'fa-sack-dollar',
  TRAINING_CAPACITY_BUILDING:         'fa-chalkboard-user',
  HSE_COMPLIANCE_CHECKLIST:           'fa-shield-heart',
  AUDIT_RESPONSE_CORRECTIVE_ACTION:   'fa-list-check',
  CERTIFICATION_REQUEST:              'fa-certificate',
  EQUIPMENT_CALIBRATION_CERTIFICATE:  'fa-gauge',
  EQUIPMENT_DISPOSAL_DECOMMISSIONING: 'fa-trash-can',
  SECURITY_SERVICES_COST_TEMPLATE:    'fa-user-shield',
  JANITORIAL_SERVICES_COST_TEMPLATE:  'fa-broom',
};

// FormRequest.js field name that holds this form type's data
const FORM_DATA_FIELD = {
  MAINTENANCE_COMPLIANCE_DECLARATION: 'complianceDeclaration',
  ASSET_INVENTORY_DECLARATION:        'inventoryDeclaration',
  PREVENTIVE_MAINTENANCE_SCHEDULE:    'pmSchedule',
  MAINTENANCE_ACTIVITY_REPORT:        'activityReport',
  MAINTENANCE_INCIDENT_REPORT:        'incidentReport',
  MAINTENANCE_WORK_ORDER:             'workOrder',
  ASSET_CONDITION_ASSESSMENT:         'conditionAssessment',
  SERVICE_PROVIDER_CERTIFICATION:     'providerCertification',
  BUDGET_ALLOCATION_UTILIZATION:      'budgetAllocation',
  TRAINING_CAPACITY_BUILDING:         'trainingCompliance',
  HSE_COMPLIANCE_CHECKLIST:           'hseChecklist',
  AUDIT_RESPONSE_CORRECTIVE_ACTION:   'auditResponse',
  CERTIFICATION_REQUEST:              'certificationRequest',
  EQUIPMENT_CALIBRATION_CERTIFICATE:  'calibrationSubmission',
  EQUIPMENT_DISPOSAL_DECOMMISSIONING: 'disposalDecommissioning',
  SECURITY_SERVICES_COST_TEMPLATE:    'securityServicesCost',
  JANITORIAL_SERVICES_COST_TEMPLATE:  'janitorialServicesCost',
};

const RATING4 = ['Very Good', 'Good', 'Fair', 'Poor'];

const FORM_FIELDS = {

  MAINTENANCE_COMPLIANCE_DECLARATION: [
    { key: 'headOfMdaName',       label: 'Head of MDA (Name)',         type: 'text' },
    { key: 'headOfMdaDesignation',label: 'Designation',                type: 'text' },
    { key: 'buildingAddress',     label: 'Address/Location of Building/Facility', type: 'textarea' },
    { key: 'maintenanceContact',  label: 'Contact Person for Maintenance', type: 'text' },
    { key: 'contactPhoneEmail',   label: 'Telephone / Email',          type: 'text' },
    { key: 'commitments.structuredPlan',       label: 'Adopt a structured maintenance plan',              type: 'checkbox' },
    { key: 'commitments.regulatoryCompliance', label: 'Comply with FPAM regulatory oversight',            type: 'checkbox' },
    { key: 'commitments.periodicReporting',    label: 'Submit periodic maintenance reports',              type: 'checkbox' },
    { key: 'commitments.qualifiedContractors', label: 'Engage only qualified contractors/consultants',    type: 'checkbox' },
    { key: 'commitments.budgetaryAllocation',  label: 'Provide budgetary allocation for maintenance',     type: 'checkbox' },
    { key: 'commitments.allowFpamAccess',      label: 'Allow FPAM access for inspections/audits',         type: 'checkbox' },
    { key: 'commitments.implementCorrective',  label: 'Implement corrective measures as directed',        type: 'checkbox' },
    { key: 'signatureName', label: 'Signatory Name', type: 'text' },
    { key: 'designation',   label: 'Signatory Designation', type: 'text' },
    { key: 'dateSigned',    label: 'Date', type: 'date' },
  ],

  ASSET_INVENTORY_DECLARATION: [
    { key: 'headOfMdaName',        label: 'Head of MDA (Name)',    type: 'text' },
    { key: 'headOfMdaDesignation', label: 'Designation',           type: 'text' },
    { key: 'mainOfficeAddress',    label: 'Address/Location of Main Office', type: 'textarea' },
    { key: 'assetRecordsContact',  label: 'Contact Person for Asset Records', type: 'text' },
    { key: 'contactPhoneEmail',    label: 'Telephone / Email',     type: 'text' },
    { key: 'assets', label: 'Asset Inventory', type: 'table', columns: [
      { key: 'assetDescription', label: 'Asset Description', type: 'text' },
      { key: 'assetType', label: 'Type', type: 'select', options: ['Building','Road','Facility','Equipment','Other'] },
      { key: 'location', label: 'Location/Address', type: 'text' },
      { key: 'yearAcquired', label: 'Year Acquired/Constructed', type: 'text' },
      { key: 'currentCondition', label: 'Condition', type: 'select', options: ['Good','Fair','Poor','Dilapidated'] },
      { key: 'presentUse', label: 'Present Use/Occupancy', type: 'text' },
      { key: 'remarks', label: 'Remarks', type: 'text' },
    ]},
    { key: 'accuracyDeclared', label: 'I declare the above is a true and correct inventory', type: 'checkbox' },
    { key: 'signatureName', label: 'Signatory Name', type: 'text' },
    { key: 'designation',   label: 'Designation', type: 'text' },
    { key: 'dateSigned',    label: 'Date', type: 'date' },
  ],

  PREVENTIVE_MAINTENANCE_SCHEDULE: [
    { key: 'maintenanceUnit',       label: 'Department/Unit in charge of Maintenance', type: 'text' },
    { key: 'contactPerson',         label: 'Contact Person (Name, Phone, Email)',      type: 'text' },
    { key: 'scheduleYearOrQuarter', label: 'Year/Quarter',        type: 'text' },
    { key: 'items', label: 'Facility / Asset Schedule', type: 'table', columns: [
      { key: 'assetDescription', label: 'Asset', type: 'text' },
      { key: 'location', label: 'Location', type: 'text' },
      { key: 'criticality', label: 'Criticality', type: 'select', options: ['High','Medium','Low'] },
      { key: 'lastMaintenanceDate', label: 'Last Maintenance', type: 'date' },
      { key: 'nextScheduledDate', label: 'Next Scheduled', type: 'date' },
      { key: 'frequency', label: 'Frequency', type: 'select', options: ['Weekly','Monthly','Quarterly','Annually'] },
      { key: 'responsibleOfficer', label: 'Responsible Officer/Unit', type: 'text' },
    ]},
    { key: 'routineInspections',    label: 'Routine Inspections Planned',   type: 'textarea' },
    { key: 'repairsServicingTasks', label: 'Repairs / Servicing Tasks',     type: 'textarea' },
    { key: 'safetyChecks',          label: 'Safety/Compliance Checks',      type: 'textarea' },
    { key: 'specializedServices',   label: 'Specialized Services Required (HVAC, Generators, IT...)', type: 'textarea' },
    { key: 'internalStaffAssigned', label: 'Internal Staff Assigned',       type: 'text' },
    { key: 'externalContractors',   label: 'External Contractors/Consultants', type: 'text' },
    { key: 'estimatedBudget',       label: 'Estimated Budget Required (₦)', type: 'number' },
  ],

  MAINTENANCE_ACTIVITY_REPORT: [
    { key: 'maintenanceUnit', label: 'Department/Unit in charge of Maintenance', type: 'text' },
    { key: 'reportPeriod',    label: 'Report Period (Month/Quarter/Year)',       type: 'text' },
    { key: 'contactPerson',   label: 'Contact Person',                          type: 'text' },
    { key: 'activities', label: 'Maintenance Activities', type: 'table', columns: [
      { key: 'assetFacility', label: 'Asset/Facility', type: 'text' },
      { key: 'location', label: 'Location', type: 'text' },
      { key: 'maintenanceType', label: 'Type', type: 'select', options: ['Preventive','Corrective','Emergency'] },
      { key: 'dateCarriedOut', label: 'Date Carried Out', type: 'date' },
      { key: 'description', label: 'Description of Activity', type: 'text' },
      { key: 'responsibleUnit', label: 'Responsible Unit/Contractor', type: 'text' },
      { key: 'cost', label: 'Cost (₦)', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', options: ['Completed','Ongoing','Pending'] },
    ]},
    { key: 'challenges.fundingConstraints', label: 'Funding Constraints',           type: 'checkbox' },
    { key: 'challenges.lackOfExpertise',    label: 'Lack of Technical Expertise',   type: 'checkbox' },
    { key: 'challenges.contractorDelay',    label: 'Delay in Contractor Response',  type: 'checkbox' },
    { key: 'challenges.accessRestrictions', label: 'Access Restrictions',           type: 'checkbox' },
    { key: 'challenges.other',              label: 'Other Challenges',              type: 'text' },
    { key: 'conditionPostMaintenance', label: 'Condition of Asset Post-Maintenance', type: 'text' },
    { key: 'efficiencyImproved',       label: 'Operational Efficiency Improved?',    type: 'checkbox' },
    { key: 'furtherActionRequired',    label: 'Further Action Required',             type: 'textarea' },
  ],

  MAINTENANCE_INCIDENT_REPORT: [
    { key: 'locationFacility', label: 'Location/Facility', type: 'text' },
    { key: 'dateOfIncident',   label: 'Date of Incident',  type: 'date' },
    { key: 'timeOfIncident',   label: 'Time of Incident',  type: 'text' },
    { key: 'reportedBy',       label: 'Reported By (Name, Designation, Contact)', type: 'text' },
    { key: 'incidentType', label: 'Type of Incident', type: 'select', options: [
      'Electrical Fault','Plumbing/Water Leakage','Structural Defect','Mechanical System Failure',
      'Fire Safety/Alarm/Sprinkler','Flooding/Drainage','Security Breach','Other',
    ]},
    { key: 'incidentTypeOther',    label: 'If Other, specify',        type: 'text' },
    { key: 'description',          label: 'Description of Incident',  type: 'textarea' },
    { key: 'immediateActionTaken', label: 'Immediate Action Taken',   type: 'textarea' },
    { key: 'assetsAffected',       label: 'Assets/Facilities Affected', type: 'text' },
    { key: 'extentOfDamage',       label: 'Extent of Damage',  type: 'select', options: ['Minor','Moderate','Severe'] },
    { key: 'serviceDisruption',    label: 'Service Disruption', type: 'select', options: ['None','Partial','Complete'] },
    { key: 'estimatedRepairCost',  label: 'Estimated Repair Cost (₦)', type: 'number' },
    { key: 'rootCause', label: 'Root Cause', type: 'select', options: [
      'Lack of Preventive Maintenance','Natural Wear & Tear','Misuse/Negligence',
      'Contractor/Service Failure','Force Majeure','Other',
    ]},
    { key: 'rootCauseOther', label: 'If Other, specify', type: 'text' },
    { key: 'followUpActions.immediateRepair',            label: 'Immediate Repair',                type: 'checkbox' },
    { key: 'followUpActions.temporaryFixApplied',        label: 'Temporary Fix Applied',            type: 'checkbox' },
    { key: 'followUpActions.comprehensiveInvestigation', label: 'Comprehensive Investigation Needed', type: 'checkbox' },
    { key: 'followUpActions.escalationToFpamHq',         label: 'Escalation to FPAM HQ',            type: 'checkbox' },
    { key: 'followUpActions.procurementRequired',        label: 'Procurement/Contract Required',    type: 'checkbox' },
    { key: 'followUpActions.other',                      label: 'Other Follow-up',                  type: 'text' },
    { key: 'reportingOfficerName', label: 'Reporting Officer Name', type: 'text' },
  ],

  MAINTENANCE_WORK_ORDER: [
    { key: 'workOrderNo', label: 'Work Order No.', type: 'text' },
    { key: 'dateIssued',  label: 'Date Issued', type: 'date' },
    { key: 'requestedBy', label: 'Requested By (Name/Designation)', type: 'text' },
    { key: 'department',  label: 'Department/MDA', type: 'text' },
    { key: 'location',    label: 'Location/Site', type: 'text' },
    { key: 'requestType', label: 'Type of Request', type: 'select', options: ['Corrective','Preventive','Emergency','Other'] },
    { key: 'requestTypeOther', label: 'If Other, specify', type: 'text' },
    { key: 'workDescription', label: 'Description of Work Requested', type: 'textarea' },
    { key: 'approvedBy',   label: 'Approved By (HOD/Authorized Officer)', type: 'text' },
    { key: 'approvalDate', label: 'Approval Date', type: 'date' },
    { key: 'assignedTo',   label: 'Assigned To (Technician/Contractor)', type: 'text' },
    { key: 'startDate',    label: 'Start Date', type: 'date' },
    { key: 'expectedCompletion', label: 'Expected Completion Date', type: 'date' },
    { key: 'priority', label: 'Priority Level', type: 'select', options: ['High','Medium','Low'] },
    { key: 'materialsRequired', label: 'Materials/Parts Required', type: 'textarea' },
    { key: 'estimatedCost', label: 'Estimated Cost (₦)', type: 'number' },
    { key: 'workDoneSummary', label: 'Work Done (Summary)', type: 'textarea' },
    { key: 'completionDate', label: 'Completion Date', type: 'date' },
    { key: 'verifiedBy', label: 'Verified By (Supervisor/Officer)', type: 'text' },
    { key: 'status', label: 'Status', type: 'select', options: ['Completed','Pending','Deferred','Rework Needed'] },
  ],

  ASSET_CONDITION_ASSESSMENT: [
    { key: 'assessmentCode',   label: 'Assessment ID/Code', type: 'text' },
    { key: 'dateOfAssessment', label: 'Date of Assessment', type: 'date' },
    { key: 'assessedBy',       label: 'Assessed By',        type: 'text' },
    { key: 'assetCategory', label: 'Asset Category', type: 'select', options: [
      'Building','Road/Car Park','Drainage/Utilities','Furniture & Fixtures','Electrical/Mechanical Equipment','Other',
    ]},
    { key: 'assetLocation',      label: 'Asset Location/Address', type: 'text' },
    { key: 'assetTagNo',         label: 'Asset Tag/Inventory No.', type: 'text' },
    { key: 'assetName',          label: 'Asset Name/Description', type: 'text' },
    { key: 'yearConstructed',    label: 'Year of Construction/Installation', type: 'text' },
    { key: 'lastRehabilitation', label: 'Last Major Rehabilitation', type: 'text' },
    { key: 'expectedUsefulLife', label: 'Expected Useful Life', type: 'text' },
    { key: 'currentUsage', label: 'Current Usage', type: 'select', options: ['Fully Functional','Under-utilized','Vacant/Idle'] },
    { key: 'ratings', label: 'Condition Ratings (5=Excellent .. 1=Critical)', type: 'ratingTable',
      components: ['Structural Integrity','Roof/Covering','Walls/Finishes','Windows & Doors','Electrical Systems',
        'Mechanical (HVAC/Plumbing)','Drainage/Waterproofing','External Works','Safety/Fire Systems'] },
    { key: 'immediateMaintenanceNeeded', label: 'Immediate Maintenance Needed', type: 'textarea' },
    { key: 'mediumTermRehab',            label: 'Medium-Term Rehabilitation',   type: 'textarea' },
    { key: 'replacementSuggested',       label: 'Replacement/Upgrade Suggested', type: 'textarea' },
    { key: 'estimatedCost',              label: 'Estimated Cost (₦)',           type: 'number' },
  ],

  SERVICE_PROVIDER_CERTIFICATION: [
    { key: 'providerName',   label: 'Service Provider/Company Name', type: 'text' },
    { key: 'rcNumber',       label: 'RC/Registration Number (CAC)',  type: 'text' },
    { key: 'tin',            label: 'Tax Identification Number (TIN)', type: 'text' },
    { key: 'contactAddress', label: 'Contact Address', type: 'textarea' },
    { key: 'emailPhone',     label: 'Email/Phone', type: 'text' },
    { key: 'category', label: 'Category of Service', type: 'select', options: [
      'Facility Management','Civil/Structural Works','Electrical/Mechanical Maintenance',
      'Sanitation/Waste Management','Security/Safety Services','Other',
    ]},
    { key: 'categoryOther', label: 'If Other, specify', type: 'text' },
    { key: 'statutoryCompliance.cacRegistration.compliant',   label: 'CAC Registration Compliant',            type: 'checkbox' },
    { key: 'statutoryCompliance.taxClearance.compliant',      label: 'Tax Clearance (Last 3 Years) Compliant', type: 'checkbox' },
    { key: 'statutoryCompliance.pencomCertificate.compliant', label: 'PENCOM Certificate Compliant',           type: 'checkbox' },
    { key: 'statutoryCompliance.itfCompliance.compliant',     label: 'ITF Compliance',                         type: 'checkbox' },
    { key: 'statutoryCompliance.nsitfCertificate.compliant',  label: 'NSITF/Employee Compensation Compliant',  type: 'checkbox' },
    { key: 'statutoryCompliance.bppRegistration.compliant',   label: 'BPP Registration/Contractor ID',         type: 'checkbox' },
    { key: 'statutoryCompliance.hseCertification.compliant',  label: 'HSE Certification',                      type: 'checkbox' },
    { key: 'equipmentAvailable', label: 'Equipment/Resources Available', type: 'textarea' },
  ],

  BUDGET_ALLOCATION_UTILIZATION: [
    { key: 'budgetYear',      label: 'Budget Year',           type: 'text' },
    { key: 'projectTitle',    label: 'Project/Activity Title', type: 'text' },
    { key: 'projectLocation', label: 'Project/Asset Location', type: 'text' },
    { key: 'budgetCode',      label: 'Budget Code/Line Item',  type: 'text' },
    { key: 'allocation', label: 'Budget Allocation', type: 'table', columns: [
      { key: 'item', label: 'Item/Component', type: 'text' },
      { key: 'approvedBudget', label: 'Approved Budget (₦)', type: 'number' },
      { key: 'dateOfAllocation', label: 'Date', type: 'date' },
      { key: 'sourceOfFunds', label: 'Source of Funds', type: 'text' },
      { key: 'remarks', label: 'Remarks', type: 'text' },
    ]},
    { key: 'totalAllocation', label: 'Total Allocation (₦)', type: 'number' },
    { key: 'utilization', label: 'Utilization / Expenditure', type: 'table', columns: [
      { key: 'item', label: 'Item/Component', type: 'text' },
      { key: 'amountUtilized', label: 'Amount Utilized (₦)', type: 'number' },
      { key: 'dateOfExpenditure', label: 'Date', type: 'date' },
      { key: 'paymentVoucherRef', label: 'Payment Voucher Ref', type: 'text' },
      { key: 'balance', label: 'Balance (₦)', type: 'number' },
      { key: 'remarks', label: 'Remarks', type: 'text' },
    ]},
    { key: 'totalUtilized', label: 'Total Utilized (₦)', type: 'number' },
    { key: 'targetOutput', label: 'Target Output (per budget)', type: 'textarea' },
    { key: 'actualOutput', label: 'Actual Output Delivered', type: 'textarea' },
    { key: 'variance', label: 'Variance (if any)', type: 'text' },
    { key: 'varianceExplanation', label: 'Explanation of Variance', type: 'textarea' },
  ],

  TRAINING_CAPACITY_BUILDING: [
    { key: 'unitDivision',    label: 'Unit/Division', type: 'text' },
    { key: 'reportingPeriod', label: 'Reporting Period', type: 'text' },
    { key: 'officerInCharge', label: 'Officer in Charge', type: 'text' },
    { key: 'trainings', label: 'Training / Program Details', type: 'table', columns: [
      { key: 'title', label: 'Training Title', type: 'text' },
      { key: 'dates', label: 'Date(s)', type: 'text' },
      { key: 'venueMode', label: 'Venue/Mode', type: 'text' },
      { key: 'targetParticipants', label: 'Target Participants', type: 'text' },
      { key: 'staffNominated', label: 'Staff Nominated', type: 'number' },
      { key: 'staffAttended', label: 'Staff Attended', type: 'number' },
      { key: 'serviceProvider', label: 'Service Provider', type: 'text' },
    ]},
    { key: 'compliance.alignedWithPolicy',       label: 'Training aligned with NPBMP/EO11',        type: 'checkbox' },
    { key: 'compliance.providerAccredited',      label: 'Service provider accredited by FPAM',     type: 'checkbox' },
    { key: 'compliance.staffTrainedPreventive',  label: 'Staff trained in preventive maintenance', type: 'checkbox' },
    { key: 'compliance.modulesDocumented',       label: 'Training modules documented & submitted', type: 'checkbox' },
    { key: 'compliance.postAssessmentConducted', label: 'Post-training assessment conducted',      type: 'checkbox' },
    { key: 'compliance.certificatesArchived',    label: 'Certificates/records issued & archived',  type: 'checkbox' },
    { key: 'skillsAcquired',  label: 'Skills Acquired',  type: 'textarea' },
    { key: 'gapsIdentified',  label: 'Gaps Identified',  type: 'textarea' },
    { key: 'followUpActions', label: 'Follow-up Actions Required', type: 'textarea' },
    { key: 'recommendations', label: 'Recommendations for Future Training', type: 'textarea' },
  ],

  HSE_COMPLIANCE_CHECKLIST: [
    { key: 'projectTitle',    label: 'Project Title', type: 'text' },
    { key: 'location',        label: 'Location', type: 'text' },
    { key: 'contractor',      label: 'Contractor/Service Provider', type: 'text' },
    { key: 'projectDuration', label: 'Project Duration', type: 'text' },
    { key: 'reportingPeriod', label: 'Reporting Period', type: 'text' },
    { key: 'generalSafety', label: 'General Safety', type: 'checkTable', items: [
      'Safety induction conducted for all staff', 'PPE provided & enforced',
      'First Aid kits available & functional', 'Emergency contact list displayed',
    ]},
    { key: 'siteManagement', label: 'Site Management', type: 'checkTable', items: [
      'Warning signs, barriers & safety notices installed', 'Fire extinguishers available & serviced',
      'Proper lighting in work areas', 'Waste properly collected & disposed',
    ]},
    { key: 'environmental', label: 'Environmental Protection', type: 'checkTable', items: [
      'Dust/noise controlled during operations', 'No hazardous waste discharged into environment',
      'Spill control measures in place', 'Energy/water used efficiently',
    ]},
    { key: 'healthWelfare', label: 'Health & Welfare', type: 'checkTable', items: [
      'Drinking water & sanitary facilities provided', 'Workers covered under health/accident insurance',
      'Work hours comply with labour regulations', 'Medical check-up provided for high-risk workers',
    ]},
    { key: 'complianceMonitoring', label: 'Compliance Monitoring', type: 'checkTable', items: [
      'HSE officer assigned on site', 'Daily/weekly safety briefings held',
      'Incident/accident register maintained', 'HSE records submitted to FPAM',
    ]},
  ],

  AUDIT_RESPONSE_CORRECTIVE_ACTION: [
    { key: 'projectTitle',       label: 'Project Title', type: 'text' },
    { key: 'auditReferenceNo',   label: 'Audit Reference No.', type: 'text' },
    { key: 'dateOfAudit',        label: 'Date of Audit', type: 'date' },
    { key: 'auditors',           label: 'Auditor(s)', type: 'text' },
    { key: 'responsibleOfficer', label: 'Responsible Officer', type: 'text' },
    { key: 'findings', label: 'Audit Findings', type: 'table', columns: [
      { key: 'findingNo', label: 'Finding No.', type: 'text' },
      { key: 'observation', label: 'Observation/Non-Conformance', type: 'text' },
      { key: 'riskLevel', label: 'Risk Level', type: 'select', options: ['High','Medium','Low'] },
      { key: 'correctiveActionRequired', label: 'Corrective Action Required', type: 'text' },
    ]},
    { key: 'correctiveActions', label: 'Corrective Action Plan', type: 'table', columns: [
      { key: 'findingNo', label: 'Finding No.', type: 'text' },
      { key: 'action', label: 'Corrective Action', type: 'text' },
      { key: 'responsibleOfficer', label: 'Responsible Officer', type: 'text' },
      { key: 'timeline', label: 'Timeline', type: 'text' },
      { key: 'resourcesNeeded', label: 'Resources Needed', type: 'text' },
    ]},
    { key: 'implementationStatus', label: 'Corrective Action Status', type: 'select', options: ['Implemented','In Progress','Pending'] },
    { key: 'implementationDate',   label: 'Date of Implementation/Follow-Up', type: 'date' },
  ],

  CERTIFICATION_REQUEST: [
    { key: 'organizationName',   label: 'Name of MDA/Organization/Service Provider', type: 'text' },
    { key: 'projectSiteAddress', label: 'Address/Location of Project/Site', type: 'textarea' },
    { key: 'projectTitle',       label: 'Project Title/Description', type: 'text' },
    { key: 'contractReferenceNo',label: 'Contract/Project Reference Number', type: 'text' },
    { key: 'contactPerson',      label: 'Contact Person', type: 'text' },
    { key: 'contactDesignation', label: 'Designation', type: 'text' },
    { key: 'phoneEmail',         label: 'Phone Number/Email', type: 'text' },
    { key: 'certificationTypeRequested', label: 'Type of Certification Requested', type: 'select', options: [
      'Maintenance Compliance Certification','Service Provider Competence Certification',
      'Asset Condition Assessment Certification','HSE Compliance Certification','Other',
    ]},
    { key: 'certificationTypeOther', label: 'If Other, specify', type: 'text' },
    { key: 'supportingDocsChecklist.complianceDeclaration',   label: 'Maintenance Compliance Declaration Form',   type: 'checkbox' },
    { key: 'supportingDocsChecklist.inventoryDeclaration',    label: 'Asset Inventory Declaration Form',          type: 'checkbox' },
    { key: 'supportingDocsChecklist.pmScheduleSubmission',    label: 'Preventive Maintenance Schedule Submission Form', type: 'checkbox' },
    { key: 'supportingDocsChecklist.activityIncidentReports', label: 'Maintenance Activity/Incident Reports',     type: 'checkbox' },
    { key: 'supportingDocsChecklist.providerCertification',   label: 'Service Provider Certification Compliance Form', type: 'checkbox' },
    { key: 'supportingDocsChecklist.hseChecklist',             label: 'HSE Compliance Checklist',                 type: 'checkbox' },
    { key: 'supportingDocsChecklist.budgetForm',                label: 'Budget Allocation & Utilization Form',     type: 'checkbox' },
    { key: 'supportingDocsChecklist.trainingForm',               label: 'Training & Capacity Building Compliance Form', type: 'checkbox' },
    { key: 'supportingDocsChecklist.auditResponseForm',          label: 'Audit Response & Corrective Action Form', type: 'checkbox' },
    { key: 'supportingDocsChecklist.other',                       label: 'Other Supporting Documents', type: 'text' },
  ],

  EQUIPMENT_CALIBRATION_CERTIFICATE: [
    { key: 'contactPerson',      label: 'Contact Person', type: 'text' },
    { key: 'contactDesignation', label: 'Designation', type: 'text' },
    { key: 'phoneEmail',         label: 'Phone Number/Email', type: 'text' },
    { key: 'equipment', label: 'Equipment Details', type: 'table', columns: [
      { key: 'equipmentNameType', label: 'Equipment Name/Type', type: 'text' },
      { key: 'modelSerialNo', label: 'Model/Serial No.', type: 'text' },
      { key: 'locationOfUse', label: 'Location of Use', type: 'text' },
      { key: 'lastCalibrationDate', label: 'Last Calibration/Inspection', type: 'date' },
      { key: 'nextDueDate', label: 'Next Due Date', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: ['Pass','Fail'] },
    ]},
    { key: 'attachmentsChecklist.manufacturerCertificate',   label: "Manufacturer's Certificate of Calibration", type: 'checkbox' },
    { key: 'attachmentsChecklist.independentLabCertificate', label: 'Independent Accredited Laboratory/Agency Certificate', type: 'checkbox' },
    { key: 'attachmentsChecklist.internalReport',            label: 'Internal Maintenance/Calibration Report',   type: 'checkbox' },
    { key: 'attachmentsChecklist.hseCertificate',             label: 'HSE Compliance Certificate for Equipment', type: 'checkbox' },
    { key: 'attachmentsChecklist.other',                       label: 'Other Supporting Documents', type: 'text' },
  ],

  EQUIPMENT_DISPOSAL_DECOMMISSIONING: [
    { key: 'departmentUnit',     label: 'Department/Unit Responsible', type: 'text' },
    { key: 'contactPerson',      label: 'Contact Person', type: 'text' },
    { key: 'contactDesignation', label: 'Designation', type: 'text' },
    { key: 'phoneEmail',         label: 'Phone Number/Email', type: 'text' },
    { key: 'assets', label: 'Asset Details', type: 'table', columns: [
      { key: 'assetCategory', label: 'Asset Category', type: 'text' },
      { key: 'description', label: 'Description (Make/Model/Type)', type: 'text' },
      { key: 'tagSerialNumber', label: 'Tag/Serial Number', type: 'text' },
      { key: 'location', label: 'Location', type: 'text' },
      { key: 'dateOfAcquisition', label: 'Date of Acquisition', type: 'date' },
      { key: 'currentCondition', label: 'Current Condition', type: 'select', options: ['Serviceable','Unserviceable','Obsolete'] },
      { key: 'proposedDisposalMethod', label: 'Proposed Disposal Method', type: 'select', options: ['Auction','Transfer','Scrap','Donation','Other'] },
    ]},
    { key: 'reasonForDisposal', label: 'Reason for Disposal/Decommissioning', type: 'select', options: [
      'End-of-Life/Obsolete','Beyond Economic Repair','Replacement by New Equipment','Safety/Environmental Hazard','Other',
    ]},
    { key: 'reasonOther', label: 'If Other, specify', type: 'text' },
    { key: 'supportingDocsChecklist.conditionAssessmentReport', label: 'Asset Condition Assessment Report', type: 'checkbox' },
    { key: 'supportingDocsChecklist.boardOfSurveyReport',       label: 'Board of Survey/Technical Evaluation Report', type: 'checkbox' },
    { key: 'supportingDocsChecklist.hseClearance',               label: 'HSE Clearance (if hazardous materials involved)', type: 'checkbox' },
    { key: 'supportingDocsChecklist.valuationReport',            label: 'Valuation Report (for auction/sale)', type: 'checkbox' },
    { key: 'supportingDocsChecklist.disposalCommitteeApproval',  label: 'Disposal Committee Approval', type: 'checkbox' },
  ],

  // ── 016: Security Services Cost Template ────────────────────────────────────
  // Lightweight summary + required attachment, not a field-for-field
  // digitization of the full worksheet — see FormRequest.js's comment on
  // this sub-schema for why.
  SECURITY_SERVICES_COST_TEMPLATE: [
    { key: 'facilityName',             label: 'Facility Name',                type: 'text' },
    { key: 'contactPerson',            label: 'Contact Person',               type: 'text' },
    { key: 'contactPhoneEmail',        label: 'Telephone / Email',            type: 'text' },
    { key: 'periodCovered',            label: 'Period Covered',               type: 'text' },
    { key: 'proposedStaffCount',       label: 'Proposed Security Staff Count', type: 'number' },
    { key: 'totalPersonnelCostAnnual', label: 'Total Personnel Cost (₦/year)', type: 'number' },
    { key: 'totalEquipmentCostAnnual', label: 'Total Equipment & Tools Cost (₦/year)', type: 'number' },
    { key: 'contingency',              label: 'Contingency (₦)',              type: 'number' },
    { key: 'projectAdministration',    label: 'Project Administration (₦)',   type: 'number' },
    { key: 'grandTotalAnnual',         label: 'Grand Total, incl. VAT (₦/year)', type: 'number' },
    { key: 'grandTotalMonthly',        label: 'Grand Total (₦/month)',        type: 'number' },
    { key: 'remarks',                  label: 'Remarks',                      type: 'textarea' },
  ],

  // ── 017: Janitorial Services Cost Template ──────────────────────────────────
  JANITORIAL_SERVICES_COST_TEMPLATE: [
    { key: 'facilityName',                       label: 'Facility Name',              type: 'text' },
    { key: 'contactPerson',                      label: 'Contact Person',             type: 'text' },
    { key: 'contactPhoneEmail',                  label: 'Telephone / Email',          type: 'text' },
    { key: 'periodCovered',                      label: 'Period Covered',             type: 'text' },
    { key: 'proposedStaffCount',                 label: 'Proposed Janitorial/Horticulture Staff Count', type: 'number' },
    { key: 'totalStaffCostAnnual',                label: 'Total Staff Payment Cost (₦/year)', type: 'number' },
    { key: 'totalCleaningConsumablesCostAnnual',  label: 'Total Cleaning Consumables Cost (₦/year)', type: 'number' },
    { key: 'mechanicalServicesCostAnnual',        label: 'Mechanical Maintenance Services Cost (₦/year)', type: 'number' },
    { key: 'electricalServicesCostAnnual',        label: 'Electrical Maintenance Services Cost (₦/year)', type: 'number' },
    { key: 'contingency',                          label: 'Contingency (₦)',           type: 'number' },
    { key: 'projectAdministration',                label: 'Project Administration (₦)', type: 'number' },
    { key: 'grandTotalAnnual',                     label: 'Grand Total, incl. VAT (₦/year)', type: 'number' },
    { key: 'grandTotalMonthly',                    label: 'Grand Total (₦/month)',     type: 'number' },
    { key: 'remarks',                              label: 'Remarks',                   type: 'textarea' },
  ],

};

// Forms that make sense linked to one specific existing asset (shows an
// asset picker on the submission form when true)
const FORM_LINKS_TO_ASSET = {
  ASSET_INVENTORY_DECLARATION: false,   // it's a whole-inventory table, not one asset
  MAINTENANCE_WORK_ORDER: true,
  ASSET_CONDITION_ASSESSMENT: true,
  EQUIPMENT_CALIBRATION_CERTIFICATE: true,
  EQUIPMENT_DISPOSAL_DECOMMISSIONING: true,
  // Both new templates are facility-wide cost estimates, not tied to one
  // specific asset already in the registry — same reasoning as 002.
  SECURITY_SERVICES_COST_TEMPLATE: false,
  JANITORIAL_SERVICES_COST_TEMPLATE: false,
};

// Forms where the completed source document itself (not just the summary
// fields above) is expected as an attachment before submission is considered
// complete. form_renderer.js / mda_portal.html can use this to show a
// stronger "attach the completed worksheet" prompt for these specific types.
const FORM_REQUIRES_ATTACHMENT = {
  SECURITY_SERVICES_COST_TEMPLATE: true,
  JANITORIAL_SERVICES_COST_TEMPLATE: true,
};

// ── Exports ───────────────────────────────────────────────────────────────────
// Dual-environment, same pattern as utils/assetCodeIndex.js — this file is
// loaded as a plain <script> tag by mda_portal.html/form_requests.html
// (globals), but also needed by form_requests_routes.js on the backend to
// avoid keeping a second, separately-maintained copy of FORM_DATA_FIELD
// (which is exactly how SECURITY_SERVICES_COST_TEMPLATE/
// JANITORIAL_SERVICES_COST_TEMPLATE almost went missing from one side —
// see the comment on FIELD_MAP in form_requests_routes.js).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FORM_LABELS, FORM_ICONS, FORM_DATA_FIELD, FORM_FIELDS,
    FORM_LINKS_TO_ASSET, FORM_REQUIRES_ATTACHMENT,
  };
}