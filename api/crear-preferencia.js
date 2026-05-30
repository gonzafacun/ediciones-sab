// ============================================================
//  EDICIONES SAB — api/crear-preferencia.js
//  Vercel Serverless Function (equivalente a crear_preferencia.php)
//
//  El HTML llama a: POST /api/crear-preferencia
//  Devuelve: { preference_id, init_point, sandbox_init_point }
// ============================================================

import { MercadoPagoConfig, Preference } from 'mercadopago';

// ── CORS helper ──────────────────────────────────────────────
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin',  process.env.BASE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ── Handler principal ────────────────────────────────────────
export default async function handler(req, res) {
  setCors(res);

  // Preflight
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Método no permitido' });

  // ── 1. Leer y validar body ──────────────────────────────
  const { items = [], payer_email = '' } = req.body ?? {};

  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'Carrito vacío o inválido' });

  // Sanitizar ítems
  const itemsLimpios = items
    .map(item => ({
      title:       String(item.title      ?? '').slice(0, 256),
      quantity:    Math.max(1, parseInt(item.quantity   ?? 1)),
      unit_price:  Math.max(0, parseFloat(item.unit_price ?? 0)),
      currency_id: 'ARS',
      category_id: String(item.category_id ?? 'others').slice(0, 64),
    }))
    .filter(i => i.title && i.unit_price > 0);

  if (itemsLimpios.length === 0)
    return res.status(400).json({ error: 'No hay ítems válidos' });

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payer_email)
    ? payer_email : '';

  const referencia = 'SAB-' + Date.now().toString(36).toUpperCase();

  // ── 2. Crear preferencia en Mercado Pago ───────────────
  const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN,
  });

  const preference = new Preference(client);

  const body = {
    items: itemsLimpios,
    payer: emailValido ? { email: emailValido } : undefined,
    back_urls: {
      success: `${process.env.BASE_URL}/gracias?estado=aprobado`,
      failure: `${process.env.BASE_URL}/gracias?estado=rechazado`,
      pending: `${process.env.BASE_URL}/gracias?estado=pendiente`,
    },
    auto_return:           'approved',
    notification_url:      `${process.env.BASE_URL}/api/webhook`,
    external_reference:    referencia,
    payment_methods: {
      installments:         12,
      default_installments: 1,
    },
    expires:                  true,
    expiration_date_from:     new Date().toISOString(),
    expiration_date_to:       new Date(Date.now() + 86_400_000).toISOString(), // +24hs
  };

  const result = await preference.create({ body });

  if (!result?.id)
    return res.status(500).json({ error: 'No se pudo crear la preferencia' });

  // Log en consola de Vercel (visible en el dashboard)
  const total = itemsLimpios.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  console.log(`[PREFERENCIA] ${referencia} | $${total.toFixed(2)} ARS | ${emailValido || 'sin email'}`);

  return res.status(200).json({
    preference_id:      result.id,
    init_point:         result.init_point,          // producción
    sandbox_init_point: result.sandbox_init_point,  // pruebas
    external_reference: referencia,
  });
}
