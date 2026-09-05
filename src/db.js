import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
const dir=path.resolve('data'); fs.mkdirSync(dir,{recursive:true});
export const db=new Database(path.join(dir,'store.db'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS admins(id INTEGER PRIMARY KEY AUTOINCREMENT,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,slug TEXT UNIQUE NOT NULL,sort_order INTEGER DEFAULT 0,active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,slug TEXT UNIQUE NOT NULL,description TEXT,details TEXT,price REAL NOT NULL,promo_price REAL,category_id INTEGER,subcategory TEXT,brand TEXT,sku TEXT UNIQUE,stock_min INTEGER DEFAULT 2,material TEXT,composition TEXT,measurements TEXT,weight REAL,washing TEXT,additional_info TEXT,featured INTEGER DEFAULT 0,on_sale INTEGER DEFAULT 0,is_new INTEGER DEFAULT 1,bestseller INTEGER DEFAULT 0,active INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(category_id) REFERENCES categories(id));
CREATE TABLE IF NOT EXISTS product_images(id INTEGER PRIMARY KEY AUTOINCREMENT,product_id INTEGER NOT NULL,url TEXT NOT NULL,is_main INTEGER DEFAULT 0,sort_order INTEGER DEFAULT 0,FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS variants(id INTEGER PRIMARY KEY AUTOINCREMENT,product_id INTEGER NOT NULL,size TEXT NOT NULL,color TEXT NOT NULL,stock INTEGER DEFAULT 0,UNIQUE(product_id,size,color),FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS coupons(id INTEGER PRIMARY KEY AUTOINCREMENT,code TEXT UNIQUE NOT NULL,type TEXT NOT NULL,value REAL NOT NULL,start_at TEXT,end_at TEXT,max_uses INTEGER,used_count INTEGER DEFAULT 0,min_order REAL DEFAULT 0,category_ids TEXT,product_ids TEXT,active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS campaigns(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,description TEXT,banner TEXT,start_at TEXT,end_at TEXT,product_ids TEXT,discount REAL DEFAULT 0,status TEXT DEFAULT 'draft');
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT,number TEXT UNIQUE NOT NULL,customer_name TEXT NOT NULL,phone TEXT NOT NULL,cpf TEXT,cep TEXT,state TEXT,city TEXT,neighborhood TEXT,street TEXT,number_address TEXT,complement TEXT,reference TEXT,payment_method TEXT,notes TEXT,subtotal REAL NOT NULL,discount REAL DEFAULT 0,total REAL NOT NULL,coupon_code TEXT,status TEXT DEFAULT 'new',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS order_items(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER NOT NULL,product_id INTEGER NOT NULL,product_name TEXT NOT NULL,size TEXT,color TEXT,quantity INTEGER NOT NULL,unit_price REAL NOT NULL,subtotal REAL NOT NULL,FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS stock_history(id INTEGER PRIMARY KEY AUTOINCREMENT,variant_id INTEGER,product_id INTEGER NOT NULL,delta INTEGER NOT NULL,reason TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT);
`);
export function setting(k, fallback=''){const r=db.prepare('SELECT value FROM settings WHERE key=?').get(k);return r?.value??fallback}
export function setSetting(k,v){db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k,String(v))}
