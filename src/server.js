import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import morgan from 'morgan';
import multer from 'multer';

import { db, setting, setSetting } from './db.js';

const app = express();

const PORT = process.env.PORT || 3000;

const JWT_SECRET =
  process.env.JWT_SECRET || 'dev-secret-change-me';

const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL ||
  'admin@marianemoreira.com.br';

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD ||
  'Mariane@2026';

const ensureAdmin = () => {
  const existing = db.prepare(
    'SELECT id FROM admins WHERE email = ?'
  ).get(ADMIN_EMAIL);

  if (!existing) {
    const hash = bcrypt.hashSync(
      ADMIN_PASSWORD,
      12
    );

    db.prepare(`
      INSERT INTO admins(email, password_hash)
      VALUES(?, ?)
    `).run(
      ADMIN_EMAIL,
      hash
    );

    console.log(
      'Administrador criado:',
      ADMIN_EMAIL
    );
  }
};

ensureAdmin();

fs.mkdirSync(
  'uploads',
  { recursive: true }
);

const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(morgan('tiny'));

app.use(
  express.json({
    limit: '2mb'
  })
);

app.use(
  express.urlencoded({
    extended: true
  })
);

app.use(
  '/uploads',
  express.static('uploads')
);

app.use(
  express.static('public')
);

const slugify = s =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const num = (
  value,
  fallback = 0
) => {
  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : fallback;
};

const productFull = id => {

  const p = db.prepare(`
    SELECT
      p.*,
      c.name category
    FROM products p
    LEFT JOIN categories c
      ON c.id = p.category_id
    WHERE p.id = ?
  `).get(id);

  if (!p) {
    return null;
  }

  p.images = db.prepare(`
    SELECT *
    FROM product_images
    WHERE product_id = ?
    ORDER BY sort_order, id
  `).all(id);

  p.variants = db.prepare(`
    SELECT *
    FROM variants
    WHERE product_id = ?
    ORDER BY size, color
  `).all(id);

  return p;
};

const auth = (
  req,
  res,
  next
) => {

  try {

    const h =
      req.headers.authorization || '';

    if (
      !h.startsWith('Bearer ')
    ) {
      throw new Error(
        'Token ausente'
      );
    }

    req.admin = jwt.verify(
      h.slice(7),
      JWT_SECRET
    );

    next();

  } catch {

    res.status(401).json({
      error: 'Não autorizado'
    });

  }
};

app.get(
  '/api/config',
  (req, res) => {

    res.json({

      storeName:
        setting(
          'store_name',
          'Mariane Moreira Concept'
        ),

      slogan:
        setting(
          'slogan',
          'Moda que traduz a sua essência.'
        ),

      heroTitle:
        setting(
          'hero_title',
          'Elegância que fala por você.'
        ),

      heroText:
        setting(
          'hero_text',
          'Moda feminina com identidade.'
        ),

      heroBanner:
        setting(
          'hero_banner',
          ''
        ),

      whatsapp:
        setting(
          'whatsapp',
          '5511945921719'
        ),

      instagram:
        setting(
          'instagram',
          ''
        ),

      primaryColor:
        setting(
          'primary_color',
          '#2B2023'
        )

    });

  }
);

app.get(
  '/api/categories',
  (req, res) => {

    res.json(
      db.prepare(`
        SELECT *
        FROM categories
        WHERE active = 1
        ORDER BY sort_order, name
      `).all()
    );

  }
);

app.get(
  '/api/products',
  (req, res) => {

    const {
      q,
      category,
      sort = 'new',
      limit = 60
    } = req.query;

    let sql = `
      SELECT
        p.*,
        c.name category
      FROM products p
      LEFT JOIN categories c
        ON c.id = p.category_id
      WHERE p.active = 1
    `;

    const args = [];

    if (q) {

      sql += `
        AND (
          p.name LIKE ?
          OR p.sku LIKE ?
          OR p.description LIKE ?
        )
      `;

      const x = `%${q}%`;

      args.push(
        x,
        x,
        x
      );
    }

    if (category) {

      sql += `
        AND (
          c.slug = ?
          OR c.id = ?
        )
      `;

      args.push(
        category,
        category
      );
    }

    const order = {

      price_asc:
        'COALESCE(p.promo_price,p.price) ASC',

      price_desc:
        'COALESCE(p.promo_price,p.price) DESC',

      bestseller:
        'p.bestseller DESC,p.created_at DESC',

      new:
        'p.created_at DESC'

    }[sort] ||
      'p.created_at DESC';

    sql += `
      ORDER BY ${order}
      LIMIT ?
    `;

    args.push(
      Math.min(
        num(limit, 60),
        100
      )
    );

    const rows =
      db.prepare(sql).all(...args);

    rows.forEach(p => {

      p.images =
        db.prepare(`
          SELECT url, is_main
          FROM product_images
          WHERE product_id = ?
          ORDER BY sort_order, id
        `).all(p.id);

      p.variants =
        db.prepare(`
          SELECT id, size, color, stock
          FROM variants
          WHERE product_id = ?
        `).all(p.id);

    });

    res.json(rows);

  }
);

app.get(
  '/api/products/:slug',
  (req, res) => {

    const p = db.prepare(`
      SELECT
        p.*,
        c.name category
      FROM products p
      LEFT JOIN categories c
        ON c.id = p.category_id
      WHERE p.slug = ?
      AND p.active = 1
    `).get(
      req.params.slug
    );

    if (!p) {

      return res.status(404).json({
        error:
          'Produto não encontrado'
      });

    }

    res.json(
      productFull(p.id)
    );

  }
);

app.post(
  '/api/auth/login',
  (req, res) => {

    const email =
      String(
        req.body?.email || ''
      ).trim();

    const password =
      String(
        req.body?.password || ''
      );

    const a = db.prepare(
      'SELECT * FROM admins WHERE email = ?'
    ).get(email);

    if (
      !a ||
      !bcrypt.compareSync(
        password,
        a.password_hash
      )
    ) {

      return res.status(401).json({
        error:
          'E-mail ou senha inválidos'
      });

    }

    res.json({

      token:
        jwt.sign(
          {
            id: a.id,
            email: a.email
          },
          JWT_SECRET,
          {
            expiresIn: '8h'
          }
        ),

      email: a.email

    });

  }
);

app.get(
  '/api/admin/dashboard',
  auth,
  (req, res) => {

    const count = sql =>
      db.prepare(sql)
        .get()?.n || 0;

    res.json({

      products:
        count(
          'SELECT COUNT(*) n FROM products'
        ),

      inStock:
        count(`
          SELECT COUNT(DISTINCT product_id) n
          FROM variants
          WHERE stock > 0
        `),

      soldOut:
        count(`
          SELECT COUNT(*) n
          FROM products p
          WHERE NOT EXISTS (
            SELECT 1
            FROM variants v
            WHERE v.product_id = p.id
            AND v.stock > 0
          )
        `),

      lowStock:
        count(`
          SELECT COUNT(*) n
          FROM variants
          WHERE stock > 0
          AND stock <= (
            SELECT stock_min
            FROM products p
            WHERE p.id = variants.product_id
          )
        `),

      orders:
        count(
          'SELECT COUNT(*) n FROM orders'
        ),

      coupons:
        count(`
          SELECT COUNT(*) n
          FROM coupons
          WHERE active = 1
        `),

      campaigns:
        count(`
          SELECT COUNT(*) n
          FROM campaigns
          WHERE status = 'active'
        `),

      recentOrders:
        db.prepare(`
          SELECT *
          FROM orders
          ORDER BY id DESC
          LIMIT 8
        `).all()

    });

  }
);
app.get('/api/admin/products', auth, (req, res) => {
  res.json(
    db.prepare(`
      SELECT
        p.*,
        c.name category,
        (
          SELECT COUNT(*)
          FROM variants v
          WHERE v.product_id = p.id
          AND v.stock > 0
        ) available_variants
      FROM products p
      LEFT JOIN categories c
        ON c.id = p.category_id
      ORDER BY p.id DESC
    `).all().map(p => ({
      ...p,
      image:
        db.prepare(`
          SELECT url
          FROM product_images
          WHERE product_id = ?
          AND is_main = 1
          LIMIT 1
        `).get(p.id)?.url ||
        '/assets/product-placeholder.svg'
    }))
  );
});

app.get('/api/admin/products/:id', auth, (req, res) => {
  const p = productFull(req.params.id);

  if (!p) {
    return res.status(404).json({
      error: 'Produto não encontrado'
    });
  }

  res.json(p);
});

app.post('/api/admin/products', auth, (req, res) => {
  try {
    const b = req.body || {};

    if (!b.name) {
      throw new Error(
        'Nome do produto é obrigatório'
      );
    }

    const price = num(b.price, NaN);

    if (!Number.isFinite(price)) {
      throw new Error(
        'Preço do produto é inválido'
      );
    }

    const promoPrice =
      b.promo_price !== undefined &&
      b.promo_price !== '' &&
      b.promo_price !== null
        ? num(b.promo_price, NaN)
        : null;

    if (
      promoPrice !== null &&
      !Number.isFinite(promoPrice)
    ) {
      throw new Error(
        'Preço promocional inválido'
      );
    }

    const slug =
      slugify(b.name) +
      '-' +
      crypto
        .randomBytes(3)
        .toString('hex');

    const r = db.prepare(`
      INSERT INTO products(
        name,
        slug,
        description,
        details,
        price,
        promo_price,
        category_id,
        subcategory,
        brand,
        sku,
        stock_min,
        material,
        composition,
        measurements,
        weight,
        washing,
        additional_info,
        featured,
        on_sale,
        is_new,
        bestseller
      )
      VALUES(
        ?,?,?,?,?,?,?,?,?,?,
        ?,?,?,?,?,?,?,?,?,?,?
      )
    `).run(
      b.name,
      slug,
      b.description || '',
      b.details || '',
      price,
      promoPrice,
      b.category_id || null,
      b.subcategory || '',
      b.brand || 'Mariane Moreira',
      b.sku || null,
      num(b.stock_min, 2),
      b.material || '',
      b.composition || '',
      b.measurements || '',
      num(b.weight, 0),
      b.washing || '',
      b.additional_info || '',
      b.featured ? 1 : 0,
      b.on_sale ? 1 : 0,
      b.is_new ? 1 : 0,
      b.bestseller ? 1 : 0
    );

    const id = r.lastInsertRowid;

    for (const v of b.variants || []) {
      db.prepare(`
        INSERT INTO variants(
          product_id,
          size,
          color,
          stock
        )
        VALUES(?,?,?,?)
      `).run(
        id,
        v.size || '',
        v.color || '',
        num(v.stock, 0)
      );
    }

    for (
      const [i, url]
      of (b.images || []).entries()
    ) {
      db.prepare(`
        INSERT INTO product_images(
          product_id,
          url,
          is_main,
          sort_order
        )
        VALUES(?,?,?,?)
      `).run(
        id,
        url,
        i === 0 ? 1 : 0,
        i
      );
    }

    res.status(201).json(
      productFull(id)
    );

  } catch (e) {
    res.status(400).json({
      error: e.message
    });
  }
});

app.put('/api/admin/products/:id', auth, (req, res) => {
  try {
    const b = req.body || {};
    const id = req.params.id;

    if (!b.name) {
      throw new Error(
        'Nome do produto é obrigatório'
      );
    }

    const price = num(b.price, NaN);

    if (!Number.isFinite(price)) {
      throw new Error(
        'Preço do produto é inválido'
      );
    }

    const promoPrice =
      b.promo_price !== undefined &&
      b.promo_price !== '' &&
      b.promo_price !== null
        ? num(b.promo_price, NaN)
        : null;

    if (
      promoPrice !== null &&
      !Number.isFinite(promoPrice)
    ) {
      throw new Error(
        'Preço promocional inválido'
      );
    }

    db.prepare(`
      UPDATE products SET
        name=?,
        description=?,
        details=?,
        price=?,
        promo_price=?,
        category_id=?,
        subcategory=?,
        brand=?,
        sku=?,
        stock_min=?,
        material=?,
        composition=?,
        measurements=?,
        weight=?,
        washing=?,
        additional_info=?,
        featured=?,
        on_sale=?,
        is_new=?,
        bestseller=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      b.name,
      b.description || '',
      b.details || '',
      price,
      promoPrice,
      b.category_id || null,
      b.subcategory || '',
      b.brand || '',
      b.sku || null,
      num(b.stock_min, 2),
      b.material || '',
      b.composition || '',
      b.measurements || '',
      num(b.weight, 0),
      b.washing || '',
      b.additional_info || '',
      b.featured ? 1 : 0,
      b.on_sale ? 1 : 0,
      b.is_new ? 1 : 0,
      b.bestseller ? 1 : 0,
      id
    );

    if (Array.isArray(b.variants)) {
      for (const v of b.variants) {

        if (v.id) {

          db.prepare(`
            UPDATE variants
            SET
              size=?,
              color=?,
              stock=?
            WHERE id=?
            AND product_id=?
          `).run(
            v.size || '',
            v.color || '',
            num(v.stock, 0),
            v.id,
            id
          );

        } else {

          db.prepare(`
            INSERT INTO variants(
              product_id,
              size,
              color,
              stock
            )
            VALUES(?,?,?,?)
          `).run(
            id,
            v.size || '',
            v.color || '',
            num(v.stock, 0)
          );

        }
      }
    }

    res.json(
      productFull(id)
    );

  } catch (e) {
    res.status(400).json({
      error: e.message
    });
  }
});

app.delete('/api/admin/products/:id', auth, (req, res) => {

  db.prepare(
    'DELETE FROM products WHERE id = ?'
  ).run(req.params.id);

  res.json({
    ok: true
  });

});

app.post(
  '/api/admin/upload',
  auth,
  upload.array('images', 12),
  (req, res) => {

    res.json(
      (req.files || []).map(f => ({
        url:
          '/uploads/' +
          f.filename,
        name:
          f.originalname
      }))
    );

  }
);

app.get(
  '/api/admin/categories',
  auth,
  (req, res) => {

    res.json(
      db.prepare(`
        SELECT *
        FROM categories
        ORDER BY sort_order, name
      `).all()
    );

  }
);

app.post(
  '/api/admin/categories',
  auth,
  (req, res) => {

    const name =
      String(
        req.body?.name || ''
      ).trim();

    if (!name) {
      return res.status(400).json({
        error:
          'Nome da categoria é obrigatório'
      });
    }

    const r = db.prepare(`
      INSERT INTO categories(
        name,
        slug,
        sort_order
      )
      VALUES(?,?,?)
    `).run(
      name,
      slugify(name),
      num(req.body.sort_order, 0)
    );

    res.json(
      db.prepare(
        'SELECT * FROM categories WHERE id = ?'
      ).get(r.lastInsertRowid)
    );

  }
);

app.put(
  '/api/admin/categories/:id',
  auth,
  (req, res) => {

    db.prepare(`
      UPDATE categories
      SET
        name=?,
        slug=?,
        sort_order=?,
        active=?
      WHERE id=?
    `).run(
      req.body.name,
      slugify(req.body.name),
      num(req.body.sort_order, 0),
      req.body.active ? 1 : 0,
      req.params.id
    );

    res.json({
      ok: true
    });

  }
);

app.delete(
  '/api/admin/categories/:id',
  auth,
  (req, res) => {

    db.prepare(
      'DELETE FROM categories WHERE id = ?'
    ).run(req.params.id);

    res.json({
      ok: true
    });

  }
);

app.get(
  '/api/admin/coupons',
  auth,
  (req, res) => {

    res.json(
      db.prepare(`
        SELECT *
        FROM coupons
        ORDER BY id DESC
      `).all()
    );

  }
);

app.post(
  '/api/admin/coupons',
  auth,
  (req, res) => {

    try {

      const b = req.body || {};

      const code =
        String(
          b.code || ''
        )
          .trim()
          .toUpperCase();

      if (!code) {
        throw new Error(
          'Código do cupom é obrigatório'
        );
      }

      const r = db.prepare(`
        INSERT INTO coupons(
          code,
          type,
          value,
          start_at,
          end_at,
          max_uses,
          min_order,
          category_ids,
          product_ids,
          active
        )
        VALUES(?,?,?,?,?,?,?,?,?,?)
      `).run(
        code,
        b.type,
        num(b.value, 0),
        b.start_at || null,
        b.end_at || null,
        b.max_uses || null,
        num(b.min_order, 0),
        b.category_ids || '',
        b.product_ids || '',
        b.active === false ? 0 : 1
      );

      res.json(
        db.prepare(
          'SELECT * FROM coupons WHERE id = ?'
        ).get(r.lastInsertRowid)
      );

    } catch (e) {

      res.status(400).json({
        error: e.message
      });

    }

  }
);

app.delete(
  '/api/admin/coupons/:id',
  auth,
  (req, res) => {

    db.prepare(
      'DELETE FROM coupons WHERE id = ?'
    ).run(req.params.id);

    res.json({
      ok: true
    });

  }
);

app.get(
  '/api/admin/campaigns',
  auth,
  (req, res) => {

    res.json(
      db.prepare(`
        SELECT *
        FROM campaigns
        ORDER BY id DESC
      `).all()
    );

  }
);

app.post(
  '/api/admin/campaigns',
  auth,
  (req, res) => {

    const b = req.body || {};

    const r = db.prepare(`
      INSERT INTO campaigns(
        name,
        description,
        banner,
        start_at,
        end_at,
        product_ids,
        discount,
        status
      )
      VALUES(?,?,?,?,?,?,?,?)
    `).run(
      b.name,
      b.description || '',
      b.banner || '',
      b.start_at || null,
      b.end_at || null,
      b.product_ids || '',
      num(b.discount, 0),
      b.status || 'draft'
    );

    res.json(
      db.prepare(
        'SELECT * FROM campaigns WHERE id = ?'
      ).get(r.lastInsertRowid)
    );

  }
);

app.delete(
  '/api/admin/campaigns/:id',
  auth,
  (req, res) => {

    db.prepare(
      'DELETE FROM campaigns WHERE id = ?'
    ).run(req.params.id);

    res.json({
      ok: true
    });

  }
);

app.get(
  '/api/admin/orders',
  auth,
  (req, res) => {

    res.json(
      db.prepare(`
        SELECT *
        FROM orders
        ORDER BY id DESC
      `).all()
    );

  }
);

app.put(
  '/api/admin/orders/:id',
  auth,
  (req, res) => {

    db.prepare(`
      UPDATE orders
      SET status=?
      WHERE id=?
    `).run(
      req.body.status,
      req.params.id
    );

    res.json({
      ok: true
    });

  }
);

app.get(
  '/api/admin/settings',
  auth,
  (req, res) => {

    res.json({

      store_name:
        setting('store_name'),

      slogan:
        setting('slogan'),

      whatsapp:
        setting('whatsapp'),

      instagram:
        setting('instagram'),

      primary_color:
        setting('primary_color'),

      hero_title:
        setting('hero_title'),

      hero_text:
        setting('hero_text'),

      hero_banner:
        setting('hero_banner')

    });

  }
);

app.put(
  '/api/admin/settings',
  auth,
  (req, res) => {

    for (
      const [k, v]
      of Object.entries(req.body || {})
    ) {
      setSetting(k, v);
    }

    res.json({
      ok: true
    });

  }
);

/* =========================
   PEDIDOS
========================= */

app.post(
  '/api/orders',
  (req, res) => {

    try {

      const b = req.body || {};

      if (
        !b.customer?.name ||
        !b.customer?.phone ||
        !Array.isArray(b.items) ||
        !b.items.length
      ) {
        throw new Error(
          'Dados do pedido incompletos'
        );
      }

      let subtotal = 0;

      const items = [];

      for (const i of b.items) {

        const p =
          productFull(
            i.productId
          );

        if (!p) {
          throw new Error(
            'Produto não encontrado'
          );
        }

        const v =
          p.variants.find(
            x =>
              String(x.id) ===
              String(i.variantId)
          );

        if (!v) {
          throw new Error(
            `Variação não encontrada: ${p.name}`
          );
        }

        const q =
          Math.floor(
            Number(i.quantity)
          );

        if (
          !Number.isFinite(q) ||
          q <= 0
        ) {
          throw new Error(
            `Quantidade inválida: ${p.name}`
          );
        }

        if (v.stock < q) {
          throw new Error(
            `Estoque insuficiente: ${p.name}`
          );
        }

        const unit =
          num(
            p.promo_price !== null &&
            p.promo_price !== undefined
              ? p.promo_price
              : p.price,
            NaN
          );

        if (
          !Number.isFinite(unit) ||
          unit < 0
        ) {
          throw new Error(
            `Preço inválido: ${p.name}`
          );
        }

        const itemSubtotal =
          Math.round(
            unit * q * 100
          ) / 100;

        if (
          !Number.isFinite(
            itemSubtotal
          )
        ) {
          throw new Error(
            `Subtotal inválido: ${p.name}`
          );
        }

        subtotal =
          Math.round(
            (
              subtotal +
              itemSubtotal
            ) * 100
          ) / 100;

        items.push({
          p,
          v,
          q,
          unit,
          sub: itemSubtotal
        });

      }

      if (
        !Number.isFinite(
          subtotal
        )
      ) {
        throw new Error(
          'Subtotal inválido'
        );
      }

      let discount = 0;
      let coupon = null;

      if (b.coupon) {

        coupon =
          db.prepare(`
            SELECT *
            FROM coupons
            WHERE code = ?
            AND active = 1
          `).get(
            String(b.coupon)
              .trim()
              .toUpperCase()
          );

        if (coupon) {

          const now =
            Date.now();

          if (
            coupon.start_at &&
            now <
              new Date(
                coupon.start_at
              ).getTime()
          ) {
            coupon = null;
          }

          if (
            coupon?.end_at &&
            now >
              new Date(
                coupon.end_at
              ).getTime()
          ) {
            coupon = null;
          }

          if (
            coupon?.max_uses &&
            coupon.used_count >=
              coupon.max_uses
          ) {
            coupon = null;
          }

          if (
            coupon &&
            subtotal >=
              num(
                coupon.min_order,
                0
              )
          ) {

            discount =
              coupon.type ===
              'percent'
                ? subtotal *
                  num(
                    coupon.value,
                    0
                  ) /
                  100
                : num(
                    coupon.value,
                    0
                  );

            discount =
              Math.min(
                subtotal,
                Math.max(
                  0,
                  Math.round(
                    discount * 100
                  ) / 100
                )
              );
          }
        }
      }

      const total =
        Math.round(
          Math.max(
            0,
            subtotal - discount
          ) * 100
        ) / 100;

      if (
        !Number.isFinite(
          discount
        ) ||
        !Number.isFinite(
          total
        )
      ) {
        throw new Error(
          'Valor do pedido inválido'
        );
      }

      const number =
        'MMC-' +
        new Date()
          .toISOString()
          .slice(0, 10)
          .replaceAll('-', '') +
        '-' +
        crypto
          .randomBytes(2)
          .toString('hex')
          .toUpperCase();

      const tx =
        db.transaction(() => {

          const o =
            db.prepare(`
              INSERT INTO orders(
                number,
                customer_name,
                phone,
                cpf,
                cep,
                state,
                city,
                neighborhood,
                street,
                number_address,
                complement,
                reference,
                payment_method,
                notes,
                subtotal,
                discount,
                total,
                coupon_code
              )
              VALUES(
                ?,?,?,?,?,?,?,?,?,?,
                ?,?,?,?,?,?,?,?
              )
            `).run(
              number,
              String(
                b.customer.name
              ),
              String(
                b.customer.phone
              ),
              String(
                b.customer.cpf || ''
              ),
              String(
                b.address?.cep || ''
              ),
              String(
                b.address?.state || ''
              ),
              String(
                b.address?.city || ''
              ),
              String(
                b.address?.neighborhood || ''
              ),
              String(
                b.address?.street || ''
              ),
              String(
                b.address?.number || ''
              ),
              String(
                b.address?.complement || ''
              ),
              String(
                b.address?.reference || ''
              ),
              String(
                b.paymentMethod || ''
              ),
              String(
                b.notes || ''
              ),
              Number(subtotal),
              Number(discount),
              Number(total),
              coupon?.code || null
            );

          for (const i of items) {

            db.prepare(`
              INSERT INTO order_items(
                order_id,
                product_id,
                product_name,
                size,
                color,
                quantity,
                unit_price,
                subtotal
              )
              VALUES(?,?,?,?,?,?,?,?)
            `).run(
              o.lastInsertRowid,
              i.p.id,
              i.p.name,
              i.v.size,
              i.v.color,
              i.q,
              Number(i.unit),
              Number(i.sub)
            );

            db.prepare(`
              UPDATE variants
              SET stock = stock - ?
              WHERE id = ?
            `).run(
              i.q,
              i.v.id
            );

            db.prepare(`
              INSERT INTO stock_history(
                variant_id,
                product_id,
                delta,
                reason
              )
              VALUES(?,?,?,?)
            `).run(
              i.v.id,
              i.p.id,
              -i.q,
              'Pedido ' + number
            );

          }

          if (coupon) {

            db.prepare(`
              UPDATE coupons
              SET used_count =
                used_count + 1
              WHERE id = ?
            `).run(coupon.id);

          }

          return o.lastInsertRowid;

        })();

      res.status(201).json({

        id: tx,

        number,

        subtotal,

        total,

        discount,

        whatsapp:
          setting(
            'whatsapp',
            '5511945921719'
          )

      });
      } catch (e) {

      console.error(
        'ERRO AO CRIAR PEDIDO:',
        e
      );

      res.status(400).json({
        error:
          e?.message ||
          'Erro ao criar pedido'
      });

    }

  }
);

app.get(
  '/api/orders/:id',
  auth,
  (req, res) => {

    const o =
      db.prepare(
        'SELECT * FROM orders WHERE id = ?'
      ).get(req.params.id);

    if (!o) {

      return res.status(404).json({
        error:
          'Pedido não encontrado'
      });

    }

    o.items =
      db.prepare(`
        SELECT *
        FROM order_items
        WHERE order_id = ?
      `).all(o.id);

    res.json(o);

  }
);

app.get(
  '/checkout',
  (req, res) => {

    res.sendFile(
      path.resolve(
        'public/checkout.html'
      )
    );

  }
);

app.get(
  '/{*splat}',
  (req, res) => {

    if (
      req.path.startsWith('/api/')
    ) {
      return res.status(404).json({
        error:
          'Rota não encontrada'
      });
    }

    res.sendFile(
      path.resolve(
        'public/index.html'
      )
    );

  }
);

app.listen(
  PORT,
  () => {

    console.log(
      `Mariane Moreira Concept: http://localhost:${PORT}`
    );

  }
);
