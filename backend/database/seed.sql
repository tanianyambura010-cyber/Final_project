USE cafe_direct;

INSERT INTO menu_items (name, description, category, price, image_url, is_available)
VALUES
  ('Avocado Toast', 'Toasted sourdough with avocado, tomato, and a soft egg.', 'Breakfast', 420.00, NULL, TRUE),
  ('Classic Pancakes', 'Fluffy pancakes served with syrup and seasonal fruit.', 'Breakfast', 480.00, NULL, TRUE),
  ('Breakfast Wrap', 'Egg, cheese, and vegetables wrapped with house sauce.', 'Breakfast', 450.00, NULL, TRUE),
  ('Chicken Burger', 'Grilled chicken burger with fries.', 'Meals', 650.00, NULL, TRUE),
  ('Beef Pilau', 'Spiced rice served with beef and kachumbari.', 'Meals', 550.00, NULL, TRUE),
  ('Vegetable Wrap', 'Fresh vegetables with house sauce in a soft wrap.', 'Meals', 420.00, NULL, TRUE),
  ('Grilled Chicken Bowl', 'Grilled chicken, rice, greens, and Bean & Dash sauce.', 'Meals', 720.00, NULL, TRUE),
  ('Garden Salad', 'Fresh lettuce, avocado, tomatoes, and lemon dressing.', 'Meals', 520.00, NULL, TRUE),
  ('Cappuccino', 'Fresh espresso with steamed milk.', 'Drinks', 250.00, NULL, TRUE),
  ('Passion Juice', 'Fresh passion juice served chilled.', 'Drinks', 180.00, NULL, TRUE),
  ('Iced Tea', 'Chilled black tea with lemon and mint.', 'Drinks', 200.00, NULL, TRUE),
  ('Mocha Latte', 'Espresso, cocoa, and steamed milk.', 'Coffee', 320.00, NULL, TRUE),
  ('Americano', 'Smooth black coffee brewed fresh.', 'Coffee', 220.00, NULL, TRUE),
  ('Caramel Macchiato', 'Espresso, milk, caramel, and foam.', 'Coffee', 360.00, NULL, TRUE),
  ('Peri-Peri Fries', 'Crispy fries tossed in peri-peri seasoning.', 'Snacks', 250.00, NULL, TRUE),
  ('Chicken Samosas', 'Crisp samosas filled with spiced chicken.', 'Snacks', 280.00, NULL, TRUE),
  ('Fruit Cup', 'Seasonal fruit served chilled.', 'Snacks', 240.00, NULL, TRUE)
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  category = VALUES(category),
  price = VALUES(price),
  image_url = VALUES(image_url),
  is_available = VALUES(is_available);
