import React from 'react';
import { TStrings } from '../../constants/quotationT';

interface Props {
  t: TStrings;
  onNew: () => void;
  onSave: () => void;
  onGeneratePreview: () => void;
  isRendering: boolean;
  onExportPDF: () => void;
  onExportExcel?: () => void;
  previewImg: string | null;
  canEdit?: boolean;
}

const cBtn = (bg: string): React.CSSProperties => ({
  background: bg, color: '#fff', border: 'none', borderRadius: 5,
  padding: '7px 10px', fontWeight: 700, cursor: 'pointer', fontSize: 13,
  width: '100%', transition: 'opacity 0.2s'
});

export default function QuotationActionsPanel({
  t, onNew, onSave, onGeneratePreview, isRendering, onExportPDF, onExportExcel, previewImg, canEdit = true
}: Props) {
  const disabledStyle: React.CSSProperties = !canEdit ? { opacity: 0.5, cursor: 'not-allowed' } : {};
  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 12 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #e9ecef', color: '#343a40' }}>
        {t.sectionActions}
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <button onClick={onNew} disabled={!canEdit} style={{...cBtn('#6c757d'), ...disabledStyle}}>{t.btnNew}</button>
        <button onClick={onSave} disabled={!canEdit} style={{...cBtn('#4361ee'), ...disabledStyle}}>{t.btnSave}</button>
        <button onClick={onGeneratePreview} disabled={!canEdit || isRendering} style={{...cBtn('#28a745'), ...disabledStyle}}>
          {isRendering ? 'Xử lý...' : t.btnUpdate}
        </button>
        <button onClick={onExportPDF} disabled={!canEdit || isRendering} style={{...cBtn('#dc3545'), ...disabledStyle}}>{t.btnPdf}</button>
      </div>

      {previewImg ? (
        <div style={{ border: '1px solid #dee2e6', borderRadius: 6, overflow: 'hidden' }}>
          <img src={previewImg} alt="A4 Preview" style={{ width: '100%', display: 'block' }} />
        </div>
      ) : (
        <div style={{
          border: '2px dashed #dee2e6', borderRadius: 6,
          aspectRatio: '1/1.414',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          color: '#adb5bd', gap: 6
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14,2 14,8 20,8" />
          </svg>
          <span style={{ fontWeight: 600, fontSize: 12 }}>{t.previewPlaceholder}</span>
        </div>
      )}
    </div>
  );
}
