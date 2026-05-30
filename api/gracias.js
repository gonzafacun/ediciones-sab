// ============================================================
//  EDICIONES SAB — api/gracias.js
//  Página de resultado post-pago (equivalente a gracias.php)
//  Ruta: /gracias?estado=aprobado|rechazado|pendiente
// ============================================================

export default function handler(req, res) {
  const estado     = req.query.collection_status ?? req.query.estado ?? '';
  const referencia = req.query.external_reference ?? '';

  const aprobado  = ['approved', 'aprobado'].includes(estado);
  const pendiente = ['pending', 'in_process', 'pendiente'].includes(estado);

  const config = aprobado
    ? { emoji: '✅', color: '#E8FFF6', titulo: '¡Pago aprobado!',
        msg: 'Gracias por tu compra. Te enviamos el comprobante a tu correo.',
        cta: `<a href="https://wa.me/+5493644677203?text=Hola!%20Orden%3A%20${encodeURIComponent(referencia)}"
                 style="display:inline-flex;align-items:center;gap:8px;background:#25D366;color:#fff;font-size:15px;font-weight:600;padding:13px 26px;border-radius:40px;text-decoration:none;margin:4px;">
                💬 Consultar por WhatsApp
              </a>
              <a href="/" style="display:inline-flex;align-items:center;gap:8px;background:#1A1A18;color:#fff;font-size:15px;font-weight:600;padding:13px 26px;border-radius:40px;text-decoration:none;margin:4px;">
                Seguir comprando
              </a>` }
    : pendiente
    ? { emoji: '⏳', color: '#FFF8E1', titulo: 'Pago en proceso',
        msg: 'Tu pago está siendo procesado por Mercado Pago. Te avisamos cuando esté confirmado.',
        cta: `<a href="https://wa.me/+5493644677203" style="display:inline-flex;align-items:center;gap:8px;background:#25D366;color:#fff;font-size:15px;font-weight:600;padding:13px 26px;border-radius:40px;text-decoration:none;margin:4px;">
                💬 Consultar estado
              </a>
              <a href="/" style="display:inline-flex;align-items:center;gap:8px;background:#1A1A18;color:#fff;font-size:15px;font-weight:600;padding:13px 26px;border-radius:40px;text-decoration:none;margin:4px;">
                Volver a la tienda
              </a>` }
    : { emoji: '❌', color: '#FFF0F0', titulo: 'Pago no completado',
        msg: 'El pago fue rechazado o cancelado. Podés intentarlo de nuevo o escribirnos.',
        cta: `<a href="/" style="display:inline-flex;align-items:center;gap:8px;background:#009EE3;color:#fff;font-size:15px;font-weight:600;padding:13px 26px;border-radius:40px;text-decoration:none;margin:4px;">
                Intentar de nuevo
              </a>
              <a href="https://wa.me/+5493644677203" style="display:inline-flex;align-items:center;gap:8px;background:#25D366;color:#fff;font-size:15px;font-weight:600;padding:13px 26px;border-radius:40px;text-decoration:none;margin:4px;">
                💬 Pedir ayuda
              </a>` };

  const refHtml = referencia
    ? `<div style="display:inline-block;background:#F5F2EE;border-radius:8px;padding:8px 16px;font-size:13px;font-family:monospace;margin:12px 0 24px;">${referencia}</div>`
    : '';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${config.titulo} — Ediciones Sab</title>
<meta name="robots" content="noindex,nofollow">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Syne:wght@700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'DM Sans',sans-serif;background:#F5F2EE;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;color:#1A1A18}
  .card{background:#fff;border-radius:20px;padding:48px 40px;max-width:480px;width:100%;text-align:center;box-shadow:0 4px 32px rgba(0,0,0,.06)}
  .icon{width:80px;height:80px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:40px;margin:0 auto 24px;background:${config.color}}
  h1{font-family:'Syne',sans-serif;font-size:26px;font-weight:800;margin-bottom:10px}
  p{font-size:15px;color:#6B6B67;line-height:1.6;margin-bottom:8px}
  footer{margin-top:28px;font-size:12px;color:#9B9B97}
  @media(max-width:500px){.card{padding:32px 20px}}
</style>
</head>
<body>
  <div class="card">
    <div class="icon">${config.emoji}</div>
    <h1>${config.titulo}</h1>
    <p>${config.msg}</p>
    ${refHtml}
    <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:4px;margin-top:${referencia ? '0' : '24px'}">
      ${config.cta}
    </div>
  </div>
  <footer>
    Ediciones Sab · Sáenz Peña, Chaco ·
    <a href="https://www.facebook.com/EdicionesSab" style="color:#009EE3;text-decoration:none;" target="_blank" rel="noopener">Facebook</a>
  </footer>
</body>
</html>`);
}
