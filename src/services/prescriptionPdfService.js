import PDFDocument from 'pdfkit';
import { saveBuffer } from './storageService.js';

const renderLine = (doc, label, value) => {
  if (value) doc.font('Helvetica-Bold').text(`${label}: `, { continued: true }).font('Helvetica').text(String(value));
};

export const generatePrescriptionPdf = async ({ appointment, prescription }) => {
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  doc.fontSize(20).font('Helvetica-Bold').text('Medical Prescription', { align: 'center' });
  doc.moveDown();
  doc.fontSize(11).font('Helvetica');
  renderLine(doc, 'Patient', appointment.patientSnapshot.name);
  renderLine(doc, 'Mobile', appointment.patientSnapshot.mobile);
  renderLine(doc, 'Age/Gender', `${appointment.patientSnapshot.age || '-'} / ${appointment.patientSnapshot.gender || '-'}`);
  renderLine(doc, 'City', appointment.patientSnapshot.city);
  renderLine(doc, 'Appointment Date', appointment.appointmentDate.toDateString());
  renderLine(doc, 'Complaint', appointment.symptoms);
  doc.moveDown();

  doc.fontSize(14).font('Helvetica-Bold').text('Diagnosis');
  doc.fontSize(11).font('Helvetica').text(prescription.diagnosis);
  doc.moveDown();

  doc.fontSize(14).font('Helvetica-Bold').text('Medicines');
  prescription.medicines.forEach((m, idx) => {
    doc.fontSize(11).font('Helvetica-Bold').text(`${idx + 1}. ${m.name}`);
    doc.font('Helvetica').text(`Dosage: ${m.dosage || '-'} | Duration: ${m.duration || '-'} | Instructions: ${m.instructions || '-'}`);
  });
  doc.moveDown();

  renderLine(doc, 'Instructions', prescription.instructions);
  if (prescription.testsSuggested?.length) renderLine(doc, 'Tests Suggested', prescription.testsSuggested.join(', '));
  if (prescription.followUpDate) renderLine(doc, 'Follow-up Date', prescription.followUpDate.toDateString());
  doc.moveDown(2);
  doc.text('Doctor Signature', { align: 'right' });
  doc.end();

  const buffer = await new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  const key = `prescriptions/${appointment._id}-${Date.now()}.pdf`;
  return saveBuffer({ key, buffer, contentType: 'application/pdf' });
};
