// ============================================================
//  EDICIONES SAB — api/webhook.js
//  Vercel Serverless Function (equivalente a webhook.php)
//
//  Mercado Pago llama a POST /api/webhook cuando hay un pago.
//  Si está aprobado → envía email al comprador y a la tienda.
//
//  Emails via Resend (resend.com) — plan gratuito: 3000/mes
// ============================================================

import { MercadoPagoConfig, Payment } from 'mercadopago';
import { Resend } from 'resend';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // ── 1. Leer notificación ────────────────────────────────
  const { type, data } = req.body ?? {};
  const dataId = data?.id ?? req.query?.id ?? '';

  console.log(`[WEBHOOK] type=${type} id=${dataId}`);

  if (type !== 'payment' || !dataId)
    return res.status(200).json({ status: 'ignorado' });

  // ── 2. Verificar pago en la API de MP ──────────────────
  const client  = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
  const paymentApi = new Payment(client);

  let pago;
  try {
    pago = await paymentApi.get({ id: Number(dataId) });
  } catch (err) {
    console.error('[WEBHOOK] Error al buscar pago:', err.message);
    return res.status(404).json({ error: 'Pago no encontrado' });
  }

  const estado     = pago.status;
  const monto      = pago.transaction_amount ?? 0;
  const referencia = pago.external_reference ?? '';
  const cuotas     = pago.installments ?? 1;
  const medioPago  = pago.payment_type_id ?? 'tarjeta';
  const emailPago  = pago.payer?.email ?? '';
  const nombre     = [pago.payer?.first_name, pago.payer?.last_name]
                       .filter(Boolean).join(' ');
  const fecha      = new Date(pago.date_approved ?? Date.now())
                       .toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

  console.log(`[WEBHOOK] Pago ${dataId} | ${estado} | $${monto} ARS | ${referencia}`);

  // ── 3. Solo actuar si está APROBADO ────────────────────
  if (estado === 'approved') {
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Email al comprador
    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailPago);
    if (emailValido) {
      await resend.emails.send({
        from:    'Ediciones Sab <no-reply@edicionessab.com.ar>',
        to:      [emailPago],
        subject: '✅ Tu compra en Ediciones Sab fue aprobada',
        html:    htmlComprador({ nombre, referencia, monto, cuotas, fecha }),
      });
      console.log(`[WEBHOOK] Email enviado al comprador: ${emailPago}`);
    }

    // Email interno a la tienda
    await resend.emails.send({
      from:    'Sistema Ediciones Sab <no-reply@edicionessab.com.ar>',
      to:      [process.env.TIENDA_EMAIL],
      subject: `🛒 Nueva venta — ${referencia} — $${monto.toFixed(2)} ARS`,
      html:    htmlTienda({ referencia, monto, cuotas, medioPago, emailPago, nombre, fecha }),
    });
    console.log(`[WEBHOOK] Email enviado a tienda: ${process.env.TIENDA_EMAIL}`);
  }

  return res.status(200).json({ status: 'ok', estado_pago: estado });
}


// ════════════════════════════════════════════════════════════
//  TEMPLATES HTML DE EMAIL
// ════════════════════════════════════════════════════════════

function htmlComprador({ nombre, referencia, monto, cuotas, fecha }) {
  const nombreDisplay = nombre || 'Cliente';
  const montoFmt      = `$ ${Number(monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  const cuotaFmt      = cuotas > 1
    ? `${cuotas} cuotas de $ ${(monto / cuotas).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
    : 'Pago en 1 cuota';

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F2EE;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F2EE;padding:32px 16px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;max-width:560px;width:100%;">
      <tr><td style="background:#1A1A18;padding:28px 32px;">
        <p style="margin:0;font-size:22px;font-weight:800;color:#fff;">● Ediciones Sab</p>
        <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,.5);">📍 Sáenz Peña, Chaco · 🕘 Lun–Vie 9:00–18:00hs</p>
      </td></tr>
      <tr><td align="center" style="padding:36px 32px 0;">
        <div style="width:72px;height:72px;background:#E8FFF6;border-radius:50%;display:inline-block;line-height:72px;font-size:36px;text-align:center;">✅</div>
        <h1 style="margin:16px 0 6px;font-size:24px;color:#1A1A18;">¡Pago aprobado!</h1>
        <p style="margin:0;font-size:15px;color:#6B6B67;">Hola ${nombreDisplay}, tu compra fue procesada correctamente.</p>
      </td></tr>
      <tr><td style="padding:28px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F2EE;border-radius:12px;padding:20px;">
          <tr>
            <td style="font-size:13px;color:#6B6B67;padding-bottom:10px;">Número de orden</td>
            <td align="right" style="font-size:13px;font-weight:700;color:#1A1A18;padding-bottom:10px;font-family:monospace;">${referencia}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6B6B67;padding-bottom:10px;">Total abonado</td>
            <td align="right" style="font-size:18px;font-weight:800;color:#1A1A18;padding-bottom:10px;">${montoFmt} ARS</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6B6B67;padding-bottom:10px;">Forma de pago</td>
            <td align="right" style="font-size:13px;color:#1A1A18;padding-bottom:10px;">${cuotaFmt}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6B6B67;">Fecha</td>
            <td align="right" style="font-size:13px;color:#1A1A18;">${fecha}</td>
          </tr>
        </table>
      </td></tr>
      <tr><td align="center" style="padding:0 32px 32px;">
        <p style="font-size:14px;color:#6B6B67;margin:0 0 16px;">¿Tenés alguna consulta? Escribinos por WhatsApp.</p>
        <a href="https://wa.me/+5493644677203?text=Hola!%20Orden%3A%20${referencia}"
           style="display:inline-block;background:#25D366;color:#fff;font-size:15px;font-weight:700;padding:14px 28px;border-radius:40px;text-decoration:none;">
          💬 Escribinos por WhatsApp
        </a>
      </td></tr>
      <tr><td style="background:#F5F2EE;padding:20px 32px;border-top:1px solid #e5e5e3;">
        <p style="margin:0;font-size:12px;color:#9B9B97;text-align:center;line-height:1.7;">
          Ediciones Sab · Sáenz Peña, Chaco, Argentina<br>
          <a href="https://wa.me/+5493644677203" style="color:#009EE3;text-decoration:none;">WhatsApp</a> ·
          <a href="https://www.facebook.com/EdicionesSab" style="color:#009EE3;text-decoration:none;">Facebook</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function htmlTienda({ referencia, monto, cuotas, medioPago, emailPago, nombre, fecha }) {
  const montoFmt   = `$ ${Number(monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  const medioLabel = { credit_card: 'Tarjeta de crédito', debit_card: 'Tarjeta de débito', account_money: 'Saldo MP' }[medioPago] ?? medioPago;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background:#F5F2EE;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
  <tr><td style="background:#1A1A18;padding:20px 24px;">
    <p style="margin:0;font-size:18px;font-weight:800;color:#fff;">🛒 Nueva venta — Ediciones Sab</p>
  </td></tr>
  <tr><td style="padding:24px;">
    <table width="100%" cellpadding="8" cellspacing="0">
      <tr><td style="font-size:13px;color:#6B6B67;border-bottom:1px solid #f0f0f0;width:140px;">Referencia</td>
          <td style="font-size:13px;font-weight:700;border-bottom:1px solid #f0f0f0;font-family:monospace;">${referencia}</td></tr>
      <tr><td style="font-size:13px;color:#6B6B67;border-bottom:1px solid #f0f0f0;">Total</td>
          <td style="font-size:16px;font-weight:800;border-bottom:1px solid #f0f0f0;color:#009EE3;">${montoFmt} ARS</td></tr>
      <tr><td style="font-size:13px;color:#6B6B67;border-bottom:1px solid #f0f0f0;">Cuotas</td>
          <td style="font-size:13px;border-bottom:1px solid #f0f0f0;">${cuotas}</td></tr>
      <tr><td style="font-size:13px;color:#6B6B67;border-bottom:1px solid #f0f0f0;">Medio</td>
          <td style="font-size:13px;border-bottom:1px solid #f0f0f0;">${medioLabel}</td></tr>
      <tr><td style="font-size:13px;color:#6B6B67;border-bottom:1px solid #f0f0f0;">Email cliente</td>
          <td style="font-size:13px;border-bottom:1px solid #f0f0f0;">${emailPago || '—'}</td></tr>
      <tr><td style="font-size:13px;color:#6B6B67;border-bottom:1px solid #f0f0f0;">Nombre</td>
          <td style="font-size:13px;border-bottom:1px solid #f0f0f0;">${nombre || '—'}</td></tr>
      <tr><td style="font-size:13px;color:#6B6B67;">Fecha</td>
          <td style="font-size:13px;">${fecha}</td></tr>
    </table>
    <p style="margin:20px 0 0;font-size:13px;color:#6B6B67;">
      Ver en Mercado Pago:<br>
      <a href="https://www.mercadopago.com.ar/activities" style="color:#009EE3;">mercadopago.com.ar/activities</a>
    </p>
  </td></tr>
</table>
</body></html>`;
}
