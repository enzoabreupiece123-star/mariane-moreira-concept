import bcrypt from 'bcryptjs'; import {db,setSetting} from './db.js';
const email=process.env.ADMIN_EMAIL||'admin@marianemoreira.com.br', pass=process.env.ADMIN_PASSWORD||'admin123';
if(!db.prepare('SELECT id FROM admins WHERE email=?').get(email)) db.prepare('INSERT INTO admins(email,password_hash) VALUES(?,?)').run(email,bcrypt.hashSync(pass,12));
const cats=['Vestidos','Blusas','Calças','Saias','Conjuntos','Croppeds','Shorts','Jaquetas','Acessórios','Lançamentos','Promoções'];
for(let i=0;i<cats.length;i++){const slug=cats[i].normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-');db.prepare('INSERT OR IGNORE INTO categories(name,slug,sort_order) VALUES(?,?,?)').run(cats[i],slug,i)}
setSetting('store_name',process.env.STORE_NAME||'Mariane Moreira Concept'); setSetting('slogan','Moda que traduz a sua essência.'); setSetting('whatsapp',process.env.WHATSAPP||'5511945921719'); setSetting('instagram',''); setSetting('primary_color','#2B2023'); setSetting('hero_title','Elegância que fala por você.'); setSetting('hero_text','Moda feminina com identidade.'); setSetting('hero_banner','');
if(!db.prepare('SELECT id FROM products LIMIT 1').get()){
 const cat=db.prepare('SELECT id FROM categories WHERE name=?').get('Vestidos').id;
 const p=db.prepare('INSERT INTO products(name,slug,description,details,price,category_id,sku,featured,is_new,bestseller,brand,material,composition,washing) VALUES(?,?,?,?,?,?,?,?,?,?,? ,?,?,?)').run('Vestido Aurora','vestido-aurora','Elegância atemporal para ocasiões especiais.','Modelagem fluida, caimento sofisticado e acabamento delicado.',389.9,cat,'MMC-AUR-001',1,1,1,'Mariane Moreira','Crepe','95% poliéster, 5% elastano','Lavar conforme etiqueta.').lastInsertRowid;
 db.prepare('INSERT INTO product_images(product_id,url,is_main) VALUES(?,?,1)').run(p,'/assets/product-placeholder.svg');
 for(const [s,c,n] of [['P','Preto',3],['M','Preto',5],['G','Preto',2],['P','Off White',2],['M','Off White',4]]) db.prepare('INSERT INTO variants(product_id,size,color,stock) VALUES(?,?,?,?)').run(p,s,c,n);
}
console.log('Seed concluído. Admin:',email,'senha:',pass);
