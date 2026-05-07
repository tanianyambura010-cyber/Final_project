USE cafe_direct;

INSERT INTO menu_items (name, description, category, price, image_url, is_available)
VALUES
  ('Chicken Burger', 'Grilled chicken burger with fries.', 'Meals', 650.00, NULL, TRUE),
  ('Beef Pilau', 'Spiced rice served with beef and kachumbari.', 'Meals', 550.00, NULL, TRUE),
  ('Vegetable Wrap', 'Fresh vegetables with house sauce in a soft wrap.', 'Meals', 420.00, NULL, TRUE),
  ('Cappuccino', 'Fresh espresso with steamed milk.', 'Drinks', 250.00, NULL, TRUE),
  ('Passion Juice', 'Fresh passion juice served chilled.', 'Drinks', 180.00, NULL, TRUE)
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  category = VALUES(category),
  price = VALUES(price),
  image_url = VALUES(image_url),
  is_available = VALUES(is_available);
