// Extra fields per asset type, stored under asset.typeData keyed by label.
// Copied from the legacy capture form (dashboard/js/capture.js TYPE_FIELDS).
export interface TypeField { label: string; type: 'text' | 'number' | 'date' | 'select'; opts?: string[]; ph?: string }

export const TYPE_FIELDS: Record<string, TypeField[]> = {
  'Infrastructure': [
    { label: 'Subtype', type: 'select', opts: ['Bridge', 'Road', 'Dam', 'Building', 'Culvert', 'Retaining Wall', 'Fence'] },
    { label: 'Age (years)', type: 'number', ph: 'e.g. 15' },
    { label: 'Span / Length (m)', type: 'number', ph: 'e.g. 40' },
    { label: 'Load Capacity (T)', type: 'number', ph: 'e.g. 80' },
    { label: 'Last Inspection', type: 'date' },
    { label: 'Owner Authority', type: 'text', ph: 'e.g. FCDA / FMWH' },
  ],
  'Land / Property': [
    { label: 'Title Number', type: 'text', ph: 'e.g. LO2834/2024' },
    { label: 'Plot Size (m²)', type: 'number', ph: 'e.g. 1450' },
    { label: 'Land Use', type: 'select', opts: ['Residential', 'Commercial', 'Industrial', 'Agricultural', 'Government', 'Mixed'] },
    { label: 'Registered Owner', type: 'text', ph: 'Name of legal owner' },
    { label: 'Survey Number', type: 'text', ph: 'e.g. SV-2024-0012' },
  ],
  'Utility': [
    { label: 'Subtype', type: 'select', opts: ['Water', 'Electricity', 'Gas', 'Telecoms', 'Sewerage', 'Irrigation'] },
    { label: 'Capacity', type: 'text', ph: 'e.g. 5000 kVA' },
    { label: 'Voltage / Pressure', type: 'text', ph: 'e.g. 33kV / 5 bar' },
    { label: 'Provider / Agency', type: 'text', ph: 'e.g. AEDC, FMWR' },
    { label: 'Install Year', type: 'number', ph: 'e.g. 2012' },
    { label: 'Operational Status', type: 'select', opts: ['Operational', 'Partially Operational', 'Non-operational', 'Under Construction', 'Decommissioned'] },
  ],
  'Environmental': [
    { label: 'Category', type: 'select', opts: ['Wetland', 'Forest', 'Erosion Site', 'Flood Plain', 'Protected Area', 'Waste Site', 'Game Reserve'] },
    { label: 'Protected Status', type: 'select', opts: ['Protected', 'Partially Protected', 'Unprotected', 'Proposed'] },
    { label: 'Key Species', type: 'text', ph: 'e.g. Savanna elephant, Mahogany' },
    { label: 'Risk Level', type: 'select', opts: ['Low', 'Medium', 'High', 'Critical'] },
    { label: 'Responsible Agency', type: 'text', ph: 'e.g. NESREA, Forestry Commission' },
  ],
  'Equipment': [
    { label: 'Make / Brand', type: 'text', ph: 'e.g. Caterpillar' },
    { label: 'Model', type: 'text', ph: 'e.g. 320D' },
    { label: 'Serial Number', type: 'text', ph: 'SN-XXXX' },
    { label: 'Manufacture Year', type: 'number', ph: 'e.g. 2019' },
    { label: 'Power / Output', type: 'text', ph: 'e.g. 150kW' },
    { label: 'Next Maintenance', type: 'date' },
  ],
};
