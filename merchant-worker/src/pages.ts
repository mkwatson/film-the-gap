import { demoProduct, ucpProtocolVersion, type StoredCart } from './protocol';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}

function money(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: demoProduct.currency,
  }).format(amount / 100);
}

function shell(title: string, content: string, script: string, nonce: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>${escapeHtml(title)}</title>
  <style nonce="${nonce}">
    :root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f8f7f4;background:#07090e;font-synthesis:none}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 78% 8%,#183a42 0,transparent 30rem),radial-gradient(circle at 4% 94%,#251b42 0,transparent 34rem),#07090e;color:#f8f7f4}a{color:inherit}button{font:inherit}.page{width:min(1120px,calc(100% - 32px));margin:auto;padding:28px 0 64px}.nav{display:flex;justify-content:space-between;align-items:center;gap:24px;margin-bottom:64px}.brand{display:flex;align-items:center;gap:11px;font-weight:740;letter-spacing:-.02em;text-decoration:none}.mark{display:grid;place-items:center;width:34px;height:34px;border:1px solid #a8ffdd66;border-radius:11px;background:#b8ffe71a;color:#b8ffe7}.tag{border:1px solid #ffffff1f;border-radius:999px;padding:7px 11px;color:#c5c8d0;font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.09em}.hero{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(300px,.95fr);gap:54px;align-items:center}.eyebrow{color:#a9ffe2;font:650 12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.12em}.hero h1{font-size:clamp(48px,7vw,88px);line-height:.94;letter-spacing:-.065em;margin:18px 0 24px;max-width:820px}.lede{color:#bdc1cb;font-size:clamp(18px,2vw,22px);line-height:1.55;max-width:690px}.panel{position:relative;border:1px solid #ffffff22;background:linear-gradient(145deg,#171b24e8,#0d1017e8);border-radius:28px;box-shadow:0 40px 100px #0009;overflow:hidden}.panel:before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,#b8ffe710,transparent 38%);pointer-events:none}.board-wrap{min-height:460px;display:grid;place-items:center;padding:40px}.board{height:390px;width:105px;border-radius:52px 52px 46px 46px;transform:rotate(13deg);background:linear-gradient(115deg,#eef2f0 0 7%,#1b2129 7% 13%,#a9ffe2 13% 18%,#9c7fff 18% 25%,#1d2229 25% 58%,#ff786d 58% 66%,#cbd3dc 66% 72%,#0d1014 72%);box-shadow:17px 30px 65px #000b,-5px -4px 0 #e7fff833;position:relative}.board:after{content:"156";position:absolute;bottom:70px;left:26px;color:#fff;font:800 26px/1 ui-monospace,SFMono-Regular,Menlo,monospace;transform:rotate(90deg)}.price-card{position:absolute;right:18px;bottom:18px;padding:17px 18px;border:1px solid #ffffff25;border-radius:17px;background:#080a10d9;backdrop-filter:blur(14px)}.price{font-size:25px;font-weight:760;letter-spacing:-.03em}.fine{color:#9298a5;font-size:12px;margin-top:5px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:54px}.fact{border:1px solid #ffffff18;border-radius:18px;background:#10131ae0;padding:20px}.fact b{display:block;margin-bottom:8px}.fact span{color:#a9afba;font-size:14px;line-height:1.45}.receipt{max-width:780px;margin:0 auto}.receipt h1{font-size:clamp(40px,6vw,70px);line-height:1;letter-spacing:-.055em;margin:18px 0}.status{display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:8px 12px;font-size:13px;font-weight:700}.status:before{content:"";width:8px;height:8px;border-radius:50%;background:currentColor;box-shadow:0 0 14px currentColor}.active{color:#a9ffe2;background:#a9ffe214;border:1px solid #a9ffe23b}.cancelled,.expired{color:#ff9c93;background:#ff786d12;border:1px solid #ff786d42}.card{border:1px solid #ffffff20;border-radius:24px;background:#11151de8;padding:26px;margin-top:24px;box-shadow:0 28px 70px #0006}.row{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:15px 0;border-bottom:1px solid #ffffff12}.row:last-child{border-bottom:0}.muted{color:#9da3ae}.total{font-size:22px;font-weight:760}.notice{margin-top:18px;padding:16px 18px;border-left:3px solid #a9ffe2;background:#a9ffe20b;color:#c9d0d2;line-height:1.5}.actions{display:flex;align-items:center;gap:14px;margin-top:24px;flex-wrap:wrap}.button{border:0;border-radius:12px;padding:12px 16px;background:#f5f4ef;color:#090b10;font-weight:750;cursor:pointer}.button:disabled{cursor:not-allowed;opacity:.55}.tools-state{color:#a6acb6;font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}.privacy{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:24px}.privacy>div{border:1px solid #ffffff16;border-radius:16px;padding:17px}.privacy strong{display:block;margin-bottom:7px}.privacy span{color:#9fa5b0;font-size:14px;line-height:1.45}.footer{margin-top:56px;color:#7f8590;font-size:12px;line-height:1.6}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(max-width:780px){.nav{margin-bottom:38px}.hero{grid-template-columns:1fr;gap:34px}.board-wrap{min-height:390px}.board{height:330px;width:90px}.grid,.privacy{grid-template-columns:1fr}.page{width:min(100% - 24px,1120px)}}
  </style>
</head>
<body>
  <main class="page">${content}</main>
  <script nonce="${nonce}">${script}</script>
</body>
</html>`;
}

export function renderMerchantHome(origin: string, nonce: string): string {
  const product = scriptJson({
    id: demoProduct.id,
    variantId: demoProduct.variantId,
    title: demoProduct.title,
    description: demoProduct.description,
    lengthCm: demoProduct.lengthCm,
    currency: demoProduct.currency,
    price: demoProduct.price,
    fulfillment: demoProduct.fulfillment,
    total: demoProduct.total,
    inventory: demoProduct.inventory,
    merchantOrigin: origin,
  });
  const content = `
    <nav class="nav"><a class="brand" href="/"><span class="mark">E</span>Evidence Market</a><span class="tag">Original test merchant</span></nav>
    <section class="hero">
      <div>
        <div class="eyebrow">A merchant that waits for evidence</div>
        <h1>See it live.<br>Then let the agent act.</h1>
        <p class="lede">One original product, one authoritative item-plus-shipping total, and no checkout. This merchant accepts a reversible UCP cart only after the live-show room has established the buyer’s evidence conditions.</p>
        <div class="grid">
          <div class="fact"><b>UCP ${ucpProtocolVersion}</b><span>Machine-discoverable cart service on the open web.</span></div>
          <div class="fact"><b>Dual-era MCP</b><span>Current stateless discovery plus the UCP-compatible binding.</span></div>
          <div class="fact"><b>Human boundary</b><span>No order, payment, or irreversible purchase exists here.</span></div>
        </div>
      </div>
      <div class="panel" aria-label="${escapeHtml(demoProduct.title)}">
        <div class="board-wrap"><div class="board" aria-hidden="true"></div></div>
        <div class="price-card"><div class="price">${money(demoProduct.price)}</div><div class="fine">+ ${money(demoProduct.fulfillment)} flat shipping = ${money(demoProduct.total)} exact · 156 cm</div></div>
      </div>
    </section>
    <p class="footer">The public product page exposes one read-only Site Tool. Cart credentials are never rendered here.</p>`;
  const script = `
    const product = ${product};
    const context = document.modelContext;
    if (context?.registerTool) {
      void context.registerTool({
        name: 'inspect_merchant_product',
        title: 'Inspect merchant product',
        description: 'Read the original Evidence Market product, item price, flat shipping, exact total, stock, and UCP merchant origin. This cannot create a cart, order, or payment.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: async () => ({ product, next: 'Return to the evidence room to establish evidence and prepare a reversible cart.' }),
      });
    }
  `;
  return shell('Evidence Market · Merchant', content, script, nonce);
}

export type ContinuationStatus = 'active' | 'cancelled' | 'expired';

export function renderContinuation(
  cart: StoredCart,
  status: ContinuationStatus,
  origin: string,
  nonce: string,
): string {
  const active = status === 'active';
  const cartView = {
    status,
    product: {
      title: demoProduct.title,
      variant: demoProduct.variantTitle,
      lengthCm: demoProduct.lengthCm,
      unitPrice: demoProduct.price,
      currency: demoProduct.currency,
      quantity: 1,
    },
    totals: {
      subtotal: demoProduct.price,
      flatShipping: demoProduct.fulfillment,
      exactTotal: demoProduct.total,
      tax: 0,
    },
    createdAt: new Date(cart.createdAt).toISOString(),
    expiresAt: new Date(cart.expiresAt).toISOString(),
    merchantOrigin: origin,
    protocol: `UCP ${ucpProtocolVersion}`,
    safetyBoundary: 'This merchant cannot create an order or accept payment.',
  };
  const content = `
    <nav class="nav"><a class="brand" href="/"><span class="mark">E</span>Evidence Market</a><span class="tag">Private continuation</span></nav>
    <section class="receipt">
      <span id="status-badge" class="status ${status}">${escapeHtml(status)}</span>
      <h1 id="cart-heading">${active ? 'A reversible cart is ready.' : status === 'cancelled' ? 'This cart was cancelled.' : 'This cart expired safely.'}</h1>
      <p class="lede">The merchant received only a fixed product variant and public action context. The buyer’s identity, price ceiling, address, and payment data never crossed this boundary.</p>
      <div class="card" aria-label="Merchant cart receipt">
        <div class="row"><div><strong>${escapeHtml(demoProduct.title)}</strong><div class="muted">${demoProduct.variantTitle} · Quantity 1</div></div><strong>${money(demoProduct.price)}</strong></div>
        <div class="row"><span class="muted">Item subtotal</span><span>${money(demoProduct.price)}</span></div>
        <div class="row"><span class="muted">Flat shipping</span><span>${money(demoProduct.fulfillment)}</span></div>
        <div class="row"><span class="muted">Exact total</span><span class="total">${money(demoProduct.total)}</span></div>
        <div class="notice">This exactly matches the room’s all-in hold. No tax is collected, and this challenge merchant has no checkout, payment handler, or order-creation capability.</div>
        <div class="actions">
          <button id="cancel-cart" class="button" type="button" ${active ? '' : 'disabled'}>${active ? 'Cancel reversible cart' : 'Cart closed'}</button>
          <span id="tools-state" class="tools-state" role="status" aria-live="polite">Checking Site Tools…</span>
        </div>
      </div>
      <div class="privacy">
        <div><strong>Merchant can see</strong><span>Variant, quantity, public intent, exact merchant total, and UCP platform profile.</span></div>
        <div><strong>Merchant cannot see</strong><span>Maximum budget, buyer identity, urgency, address, payment, or evidence-room credentials.</span></div>
      </div>
      <p class="footer">This private URL is a bearer credential. It is sent only to the buyer who invoked the room action, is never broadcast to the host, and carries a no-referrer policy.</p>
    </section>`;
  const script = `
    const cart = ${scriptJson(cartView)};
    const cartId = ${scriptJson(cart.id)};
    const endpoint = ${scriptJson(`${origin}/api/ucp/mcp`)};
    const profile = ${scriptJson(`${origin}/.well-known/ucp`)};
    const state = { status: ${scriptJson(status)} };
    const statusBadge = document.querySelector('#status-badge');
    const cartHeading = document.querySelector('#cart-heading');
    const cancelButton = document.querySelector('#cancel-cart');
    const toolsState = document.querySelector('#tools-state');
    let cancelToolController = null;

    function showCancelled() {
      state.status = 'cancelled';
      if (statusBadge) {
        statusBadge.textContent = 'cancelled';
        statusBadge.className = 'status cancelled';
      }
      if (cancelButton instanceof HTMLButtonElement) {
        cancelButton.disabled = true;
        cancelButton.textContent = 'Cart closed';
      }
      if (cartHeading) cartHeading.textContent = 'This cart was cancelled.';
      if (toolsState) toolsState.textContent = 'Cart cancelled · inspect Site Tool remains live.';
      if (cancelToolController !== null) {
        const controller = cancelToolController;
        cancelToolController = null;
        setTimeout(() => controller.abort(), 0);
      }
    }

    async function cancelCart() {
      if (state.status !== 'active') return { ok: true, status: state.status, alreadyClosed: true };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: crypto.randomUUID(),
          method: 'tools/call',
          params: {
            name: 'cancel_cart',
            arguments: {
              meta: { 'ucp-agent': { profile }, 'idempotency-key': crypto.randomUUID() },
              id: cartId,
            },
          },
        }),
      });
      const body = await response.json();
      if (!response.ok || body.error || body.result?.isError === true) throw new Error('Merchant cancellation failed.');
      showCancelled();
      return { ok: true, status: 'cancelled', safetyBoundary: cart.safetyBoundary };
    }

    if (cancelButton instanceof HTMLButtonElement && state.status === 'active') {
      cancelButton.addEventListener('click', async () => {
        if (!confirm('Cancel this reversible merchant cart? No order or payment exists.')) return;
        cancelButton.disabled = true;
        toolsState.textContent = 'Cancelling…';
        try {
          await cancelCart();
          toolsState.textContent = 'Cancelled at the merchant.';
        } catch {
          cancelButton.disabled = false;
          toolsState.textContent = 'Cancellation failed; the cart will still expire automatically.';
        }
      });
    }

    const context = document.modelContext;
    if (!context?.registerTool) {
      toolsState.textContent = 'Ordinary-browser controls ready.';
    } else {
      Promise.all([
        context.registerTool({
          name: 'inspect_merchant_cart',
          title: 'Inspect private merchant cart',
          description: 'Read this private UCP cart, product, total, expiry, privacy boundary, and merchant status. This cannot create an order or payment.',
          inputSchema: { type: 'object', properties: {}, additionalProperties: false },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: async () => ({ ...cart, status: state.status }),
        }),
        ...(state.status === 'active' ? [(() => {
          cancelToolController = new AbortController();
          return context.registerTool({
            name: 'cancel_merchant_cart',
            title: 'Cancel reversible merchant cart',
            description: 'Cancel this active UCP cart at the merchant. This closes only the reversible cart and cannot create an order, purchase, charge, or payment.',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, untrustedContentHint: true },
            execute: async () => cancelCart(),
          }, { signal: cancelToolController.signal });
        })()] : []),
      ]).then(() => { toolsState.textContent = 'Site Tools live.'; }).catch(() => { toolsState.textContent = 'Ordinary-browser controls ready.'; });
    }
  `;
  return shell('Evidence Market · Private cart', content, script, nonce);
}
