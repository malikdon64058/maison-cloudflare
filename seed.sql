-- Maison seed: 42 products, 5 categories, 3 coupons.
-- Run: wrangler d1 execute maison --local --file=./seed.sql
-- Admin account is NOT in this file. Generate it with:
--   ADMIN_PASSWORD='...' npm run generate-admin
-- then run the generated admin.sql. Change that password after first sign-in.
INSERT OR IGNORE INTO categories(id, name, slug) VALUES
 (1,'Ceramics','ceramics'),(2,'Textiles','textiles'),(3,'Lighting','lighting'),
 (4,'Furniture','furniture'),(5,'Kitchen & Dining','kitchen-dining');
INSERT OR IGNORE INTO products(id,name,slug,sku,category_id,description,specs,price_cents,sale_price_cents,stock,featured,image_key) VALUES
 (1,'Aura Stoneware Vase','aura-stoneware-vase','CER-VASE-01',1,'A softly tapered vase in matte stoneware, glazed inside so it holds water for fresh stems. Each piece is finished by hand, so the glaze breaks slightly differently on every one.','{"Material":"Stoneware","Height":"24 cm","Care":"Rinse and wipe clean","Origin":"Small-batch studio"}',6400,NULL,24,1,'vase'),
 (2,'Kiln Stoneware Mug Set · 4','kiln-stoneware-mug-set','CER-MUG-04',1,'Four generous 350 ml mugs in a speckled oat glaze, each with a comfortable three-finger handle. Made for slow mornings and second coffees.','{"Material":"Stoneware","Capacity":"350 ml each","Care":"Dishwasher & microwave safe"}',4800,NULL,42,0,'mugs'),
 (3,'Moon Serving Bowl','moon-serving-bowl','CER-BOWL-01',1,'A wide, low serving bowl in matte moon-white porcelain — big enough for a family salad or a pile of roast potatoes, elegant enough for guests.','{"Material":"Porcelain","Diameter":"28 cm","Care":"Dishwasher safe"}',5600,4400,23,1,'bowl'),
 (4,'Sadie Stoneware Dinnerware Set · 16 pc','sadie-dinnerware-set','CER-DIN-16',1,'A complete 16-piece stoneware dinner set for four, in a warm speckled glaze. Plates, bowls, side plates and mugs included.','{"Material":"Stoneware","Pieces":"16","Care":"Dishwasher safe"}',14800,NULL,12,0,'dinnerware'),
 (5,'Ember Soy Candle','ember-soy-candle','DEC-CAND-01',1,'Hand-poured soy candle in an amber glass vessel. Cedar, smoked amber, and a little clove. Around 45 hours of burn time with a crackling wooden wick.','{"Wax":"100% soy","Burn time":"≈45 hours","Scent":"Cedar, amber, clove"}',2800,NULL,64,0,'candle'),
 (6,'Stoneware Teapot','stoneware-teapot','CER-TEA-01',1,'A sturdy stoneware teapot with a well-fitting lid and a drip-free spout. Brews two generous mugs.','{"Material":"Stoneware","Capacity":"750 ml"}',7200,NULL,15,0,'teapot'),
 (7,'Terracotta Planter','terracotta-planter','CER-PLA-01',1,'Unglazed terracotta planter with a drainage hole and matching saucer. Ages beautifully outdoors.','{"Material":"Terracotta","Diameter":"26 cm"}',3800,NULL,20,0,'planter'),
 (8,'Ceramic Butter Dish','ceramic-butter-dish','CER-BUT-01',1,'A lidded ceramic butter dish that fits a standard block, with a soft matte glaze.','{"Material":"Ceramic"}',2600,NULL,25,0,'butter'),
 (9,'Matte Espresso Cups · 2','matte-espresso-cups','CER-ESP-02',1,'Two matte espresso cups with a thick wall that keeps coffee hot a little longer.','{"Material":"Ceramic","Capacity":"80 ml each"}',3400,NULL,28,0,'espresso'),
 (10,'Speckled Cereal Bowl','speckled-cereal-bowl','CER-CER-01',1,'A deep speckled cereal bowl, equally at home with porridge, soup or salad.','{"Material":"Stoneware","Diameter":"16 cm"}',3200,NULL,30,0,'cereal'),
 (11,'European Linen Throw','european-linen-throw','TEX-THROW-01',2,'A soft European linen throw, pre-washed for drape, in a natural undyed tone.','{"Material":"100% linen","Size":"130 × 180 cm"}',6900,NULL,18,0,'throw'),
 (12,'Kazak Wool Area Rug','kazak-wool-rug','TEX-RUG-01',2,'A hand-knotted Kazak wool rug in a classic geometric pattern. Dense, durable and soft underfoot.','{"Material":"Wool","Size":"160 × 230 cm"}',28900,NULL,5,0,'rug'),
 (13,'Cotton Duvet Set','cotton-duvet-set','TEX-DUV-01',2,'Crisp cotton duvet cover and two pillowcases, garment-washed for softness.','{"Material":"100% cotton"}',12900,NULL,10,0,'duvet'),
 (14,'Linen Cushion Covers · 2','linen-cushion-covers','TEX-CUS-02',2,'Two linen cushion covers with hidden zips, in a stone-neutral tone. Inserts not included.','{"Material":"Linen","Size":"45 × 45 cm"}',5400,NULL,20,0,'cushions'),
 (15,'Waffle Bath Towels · 4','waffle-bath-towels','TEX-TOW-04',2,'Four absorbent waffle-weave bath towels that dry fast and pack light.','{"Material":"Cotton"}',5800,NULL,24,0,'towels'),
 (16,'Wool Throw Blanket','wool-throw-blanket','TEX-WOO-01',2,'A warm wool throw blanket with a fringed edge, for sofas and cold evenings.','{"Material":"Wool blend"}',8900,NULL,14,0,'woolthrow'),
 (17,'Linen Table Runner','linen-table-runner','TEX-TAB-01',2,'A long linen table runner that softens a wooden table without hiding it.','{"Material":"Linen","Size":"40 × 180 cm"}',4500,NULL,16,0,'runner'),
 (18,'Cotton Apron','cotton-apron','TEX-APR-01',2,'A sturdy cotton apron with a cross-back strap and a deep pocket.','{"Material":"Cotton"}',3900,NULL,30,0,'apron'),
 (19,'Seagrass Storage Basket','seagrass-storage-basket','DEC-BASK-01',2,'Hand-woven seagrass basket with sturdy carry handles — for throws, toys, firewood, or a very large plant. Folds flat when not in use.','{"Material":"Seagrass & cotton cord","Diameter":"38 cm","Care":"Spot clean"}',4200,NULL,0,0,'basket'),
 (20,'Chunky Knit Blanket','chunky-knit-blanket','TEX-KNI-01',2,'A chunky knit blanket in soft acrylic-wool blend, for layering on beds and sofas.','{"Material":"Acrylic-wool blend"}',9900,NULL,9,0,'knit'),
 (21,'Halo Touch Table Lamp','halo-touch-lamp','LIG-LAMP-01',3,'A touch-dimmable table lamp with a warm halo glow and a linen shade.','{"Material":"Metal, linen","Bulb":"E27, included"}',11900,NULL,11,1,'lamp'),
 (22,'Frida Brass Pendant','frida-brass-pendant','LIG-PEND-01',3,'A spun brass pendant with a warm, focused glow — made for kitchen islands and dining tables.','{"Material":"Brass","Drop":"Adjustable"}',13900,NULL,8,1,'pendant'),
 (23,'Mini Globe Pendant','mini-globe-pendant','LIG-PEND-02',3,'A small opal globe pendant for clusters, hallways and bedside lighting.','{"Material":"Glass, metal"}',8900,NULL,0,0,'globe'),
 (24,'Ceramic Table Lamp','ceramic-table-lamp','LIG-LAMP-02',3,'A glazed ceramic table lamp with a simple drum shade and a warm bulb.','{"Material":"Ceramic"}',9800,NULL,13,0,'ceramiclamp'),
 (25,'Rattan Floor Lamp','rattan-floor-lamp','LIG-FLO-01',3,'A tall rattan floor lamp that throws a soft, dappled light across a room.','{"Material":"Rattan, metal"}',17900,NULL,6,0,'floorlamp'),
 (26,'Brass Wall Sconce','brass-wall-sconce','LIG-SCO-01',3,'A brass wall sconce with a fabric shade, for hallways and reading corners.','{"Material":"Brass"}',7600,NULL,10,0,'sconce'),
 (27,'Oslo Oak Side Table','oslo-oak-side-table','FUR-TABLE-01',4,'Solid oak side table with softly rounded edges and a lower shelf. Finished in hardwax oil; assembles in five minutes with the included hex key.','{"Material":"Solid oak, hardwax oil","Size":"45 × 45 × 55 cm","Assembly":"5 min, tool included"}',18900,15900,7,1,'table'),
 (28,'Oslo Oak Coffee Table','oslo-oak-coffee-table','FUR-TABLE-02',4,'A low, solid-oak coffee table with a softened live edge and room underneath for books and baskets. Finished in hardwax oil.','{"Material":"Solid oak, hardwax oil","Size":"100 × 60 × 38 cm","Assembly":"Legs only, 5 min"}',24900,NULL,5,0,'coffeetable'),
 (29,'Ash Writing Desk','ash-writing-desk','FUR-DESK-01',4,'A compact ash desk with two soft-close drawers and a cable slot — sized for a laptop, a lamp, and a small apartment.','{"Material":"Solid ash","Size":"110 × 55 × 75 cm","Assembly":"10 min, tool included"}',34900,NULL,4,0,'desk'),
 (30,'Grecia Wooden Dining Chair','grecia-dining-chair','FUR-CHAIR-01',4,'A solid pine dining chair with a shaped seat and slatted back, finished in a warm honey stain. Stacks neatly and shrugs off daily use.','{"Material":"Solid pine","Size":"45 × 52 × 95 cm","Assembly":"None — arrives built"}',15900,NULL,10,1,'chair'),
 (31,'Grecia Dining Chairs · Pair','grecia-dining-chairs-pair','FUR-CHAIR-02',4,'Two Grecia dining chairs, matched for grain and tone. The economical way to start — or complete — a set around the table.','{"Material":"Solid pine","Includes":"2 chairs","Assembly":"None — arrives built"}',29800,26900,6,0,'chairpair'),
 (32,'Oak Bookshelf','oak-bookshelf','FUR-SHE-01',4,'A solid oak bookshelf with four adjustable shelves and a low, stable footprint.','{"Material":"Oak","Size":"90 × 30 × 180 cm"}',32900,NULL,5,0,'bookshelf'),
 (33,'Walnut Bench','walnut-bench','FUR-BEN-01',4,'A walnut bench for hallways, dining tables and the foot of a bed.','{"Material":"Walnut","Size":"120 × 35 × 45 cm"}',21900,NULL,7,0,'bench'),
 (34,'Brushed Steel Cutlery Set · 16 pc','brushed-steel-cutlery','KIT-CUT-16',5,'A brushed steel cutlery set for four: knives, forks, spoons and teaspoons, with a soft matte finish.','{"Material":"18/10 steel","Pieces":"16","Care":"Dishwasher safe"}',7900,NULL,18,0,'cutlery'),
 (35,'Cast Iron Skillet','cast-iron-skillet','KIT-SKI-01',5,'A pre-seasoned cast iron skillet that goes from hob to oven and improves with use.','{"Material":"Cast iron","Diameter":"28 cm"}',6900,NULL,15,0,'skillet'),
 (36,'Wooden Serving Board','wooden-serving-board','KIT-BOA-01',5,'An acacia serving board with a handle, for cheese, bread and sharing platters.','{"Material":"Acacia"}',4500,NULL,20,0,'board'),
 (37,'Stoneware Baking Dish','stoneware-baking-dish','KIT-BAK-01',5,'A deep stoneware baking dish for gratins, roasts and crumbles.','{"Material":"Stoneware","Size":"32 × 22 cm"}',5200,NULL,16,0,'bakingdish'),
 (38,'Linen Napkins · 4','linen-napkins','KIT-NAP-04',5,'Four washed linen napkins in a natural tone, softening with every wash.','{"Material":"Linen"}',3800,NULL,25,0,'napkins'),
 (39,'Glass Carafe Set','glass-carafe-set','KIT-CAR-01',5,'A glass carafe with four tumblers, for water, juice and long lunches.','{"Material":"Glass"}',4200,NULL,18,0,'carafe'),
 (40,'Enamel Dutch Oven','enamel-dutch-oven','KIT-DUT-01',5,'An enamelled cast iron Dutch oven for soups, stews and slow braises.','{"Material":"Cast iron, enamel","Capacity":"5.5 L"}',14900,NULL,8,0,'dutchoven'),
 (41,'Marble Mortar & Pestle','marble-mortar-pestle','KIT-MOR-01',5,'A heavy marble mortar and pestle for grinding spices and making pesto.','{"Material":"Marble"}',5600,NULL,12,0,'mortar'),
 (42,'Tea Towels · 3','tea-towels','KIT-TEA-03',5,'Three absorbent cotton tea towels in a classic stripe.','{"Material":"Cotton"}',2900,NULL,30,0,'teatowels');
INSERT OR IGNORE INTO variants(product_id,name,sku,price_delta_cents,stock) VALUES
 (5,'180 g','DEC-CAND-01-180',0,40),(5,'320 g','DEC-CAND-01-320',1400,24),
 (2,'Set of 2','CER-MUG-04-2',-1800,25),(2,'Set of 4','CER-MUG-04-4',0,42),
 (22,'Brass','LIG-PEND-01-BR',0,8),(30,'Honey stain','FUR-CHAIR-01-HO',0,10);
INSERT OR IGNORE INTO coupons(code,type,value,min_subtotal_cents,max_uses,expires_at) VALUES
 ('WELCOME10','percent',10,0,NULL,'2027-12-31T00:00:00.000Z'),
 ('MAISON25','fixed',2500,15000,100,'2027-12-31T00:00:00.000Z'),
 ('FREESHIP','free_shipping',0,4000,NULL,'2027-12-31T00:00:00.000Z');
