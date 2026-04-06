import React from 'react';
import { Customer, RowItem } from '../../types';
import { TStrings } from '../../constants/quotationT';
import { TariffItem } from './QuotationTariffModal';

interface ProcessedData {
  rows: Array<RowItem & { lineTotal: number }>;
  grand: number;
  inWords: string;
}

interface Props {
  t: TStrings;
  quoteNo: string; onQuoteNoChange: (v: string) => void;
  quoteDate: string; onQuoteDateChange: (v: string) => void;
  customerName: string; onCustomerChange: (v: string) => void;
  taxCode: string; onTaxCodeChange: (v: string) => void;
  address: string; onAddressChange: (v: string) => void;
  phone: string; onPhoneChange: (v: string) => void;
  notes: string; onNotesChange: (v: string) => void;
  customers: Customer[];
  items: RowItem[];
  tariffList: TariffItem[];
  services: Array<{ id: string; name: string; unit?: string; price?: number }>;
  updateRow: (id: string, patch: Partial<RowItem>) => void;
  removeRow: (id: string) => void;
  addRow: () => void;
  processed: ProcessedData;
}

export default function QuotationFormSection({
  t, quoteNo, onQuoteNoChange, quoteDate, onQuoteDateChange,
  customerName, onCustomerChange, taxCode, onTaxCodeChange,
  address, onAddressChange, phone, onPhoneChange,
  notes, onNotesChange,
  customers, items, tariffList, services,
  updateRow, removeRow, addRow, processed
}: Props) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #e9ecef', color: '#343a40' }}>
        {t.sectionInfo}
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
        <div>
          <div style={cLabel}>{t.labelQuoteNo}</div>
          <input style={cInput} value={quoteNo} onChange={e => onQuoteNoChange(e.target.value)} />
        </div>
        <div>
          <div style={cLabel}>{t.labelDate}</div>
          <input style={cInput} value={quoteDate} onChange={e => onQuoteDateChange(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
        <div>
          <div style={cLabel}>{t.labelCustomer}</div>
          <input
            style={cInput} list="cust-list"
            value={customerName}
            onChange={e => onCustomerChange(e.target.value)}
            placeholder={t.labelCustomer}
          />
          <datalist id="cust-list">
            {customers.map(c => <option key={c.id} value={c.name} />)}
          </datalist>
        </div>
        <div>
          <div style={cLabel}>{t.labelTaxCode}</div>
          <input style={cInput} value={taxCode} onChange={e => onTaxCodeChange(e.target.value)} placeholder={t.labelTaxCode + ' (nếu có)'} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
        <div>
          <div style={cLabel}>{t.labelAddress}</div>
          <input style={cInput} value={address} onChange={e => onAddressChange(e.target.value)} placeholder={t.labelAddress} />
        </div>
        <div>
          <div style={cLabel}>{t.labelPhone}</div>
          <input style={cInput} value={phone} onChange={e => onPhoneChange(e.target.value)} placeholder={t.labelPhone} />
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={cLabel}>{t.labelNotes}</div>
        <input style={cInput} value={notes} onChange={e => onNotesChange(e.target.value)} placeholder="Ghi chú..." />
      </div>

      {/* Items Table */}
      <div style={{ overflowX: 'auto', marginBottom: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f8f9fa' }}>
              <th style={cTh}>{t.thService}</th>
              <th style={{ ...cTh, width: 68, textAlign: 'center' }}>{t.thQty}</th>
              <th style={{ ...cTh, width: 90, textAlign: 'right' }}>{t.thPrice}</th>
              <th style={{ ...cTh, width: 100, textAlign: 'right' }}>{t.thAmount}</th>
              <th style={{ ...cTh, width: 28 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const isStorage = item.name.toLowerCase().includes(t.storageKw);
              const isPower = item.name.toLowerCase().includes(t.powerKw);
              return (
                <React.Fragment key={item.id}>
                  <tr>
                    <td style={cTd}>
                      <select
                        value={item.name}
                        style={{ width: '100%', border: '1px solid #ced4da', borderRadius: 3, padding: '3px 6px', fontSize: 12 }}
                        onChange={e => {
                          const val = e.target.value;
                          const svc = tariffList.find(s => s.name === val) || services.find(s => s.name === val);
                          updateRow(item.id, { name: val, price: svc?.price ?? item.price, unit: svc?.unit ?? item.unit });
                        }}
                      >
                        <option value="">{t.selectService}</option>
                        {tariffList.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        {tariffList.length === 0 && services.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        <option value={t.otherService}>{t.otherService}</option>
                      </select>
                    </td>
                    <td style={cTd}>
                      <input type="number" min={1}
                        style={{ ...cInput, textAlign: 'center', padding: '3px 4px', marginBottom: 0 }}
                        value={item.quantity}
                        onChange={e => updateRow(item.id, { quantity: Number(e.target.value) })}
                      />
                    </td>
                    <td style={cTd}>
                      <input type="number"
                        style={{ ...cInput, textAlign: 'right', padding: '3px 4px', marginBottom: 0 }}
                        value={item.price}
                        readOnly={!!(tariffList.find(s => s.name === item.name) || services.find(s => s.name === item.name)) && item.name !== t.otherService}
                        onChange={e => updateRow(item.id, { price: Number(e.target.value) })}
                      />
                    </td>
                    <td style={{ ...cTd, textAlign: 'right', fontWeight: 700 }}>
                      {((isStorage || isPower)
                        ? item.containerQty * item.quantity * item.price
                        : item.quantity * item.price
                      ).toLocaleString()} đ
                    </td>
                    <td style={{ ...cTd, textAlign: 'center' }}>
                      <button onClick={() => removeRow(item.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc3545', fontSize: 14, padding: 0 }}
                        title="Xóa dòng"
                      >×</button>
                    </td>
                  </tr>
                  {(isStorage || isPower) && (
                    <tr>
                      <td colSpan={5} style={{ ...cTd, background: '#fafafa', paddingTop: 4, paddingBottom: 4 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, color: '#555' }}>{t.containerQtyLbl}</span>
                          <input type="number" min={1}
                            style={{ width: 50, ...cInput, padding: '2px 4px', marginBottom: 0, fontSize: 11 }}
                            value={item.containerQty}
                            onChange={e => updateRow(item.id, { containerQty: Number(e.target.value) })}
                          />
                          {isStorage && (
                            <>
                              <span style={{ fontSize: 11, color: '#555' }}>{t.dateFromLbl}</span>
                              <input type="date" style={{ ...cInput, padding: '2px 4px', marginBottom: 0, fontSize: 11 }} value={item.startDate} onChange={e => updateRow(item.id, { startDate: e.target.value })} />
                              <span style={{ fontSize: 11, color: '#555' }}>{t.dateToLbl}</span>
                              <input type="date" style={{ ...cInput, padding: '2px 4px', marginBottom: 0, fontSize: 11 }} value={item.endDate} onChange={e => updateRow(item.id, { endDate: e.target.value })} />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <button onClick={addRow}
        style={{ background: '#4361ee', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 14px', fontWeight: 700, cursor: 'pointer', fontSize: 13, marginBottom: 10 }}
      >{t.addRow}</button>

      <div style={{ textAlign: 'right', borderTop: '1px solid #dee2e6', paddingTop: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          {t.total} <span style={{ color: '#4361ee' }}>{processed.grand.toLocaleString()} đ</span>
        </div>
        <div style={{ color: '#555', fontSize: 11, marginTop: 2 }}>
          <em>{processed.inWords} {t.dong}.</em>
        </div>
      </div>
    </div>
  );
}

const cLabel: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#868e96', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 };
const cInput: React.CSSProperties = { width: '100%', border: '1px solid #dee2e6', borderRadius: 4, padding: '5px 8px', fontSize: 13, boxSizing: 'border-box', outline: 'none', background: '#fff', marginBottom: 0 };
const cTh: React.CSSProperties = { textAlign: 'left', padding: '6px 8px', fontSize: 11, fontWeight: 700, color: '#6c757d', textTransform: 'uppercase', border: '1px solid #dee2e6' };
const cTd: React.CSSProperties = { padding: '5px 8px', border: '1px solid #dee2e6', verticalAlign: 'middle', fontSize: 12 };
