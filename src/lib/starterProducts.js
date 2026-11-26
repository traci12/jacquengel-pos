// Popular Filipino snacks and soft drinks with typical 2026 sari-sari prices.
// Prices are starting estimates (wholesale cost vs. suggested retail, based on the
// PinoyNegosyo.net 2026 Sari-Sari Store Price List). Adjust them to your supplier.
// [name, category, cost, price, unit, lowStock]
const rows = [
  // Chips & junk food
  ['Piattos Cheese 40g', 'Chips & Snacks', 16, 22, 'pack', 5],
  ['Nova Multigrain 40g', 'Chips & Snacks', 16, 22, 'pack', 5],
  ['Chippy Barbecue 27g', 'Chips & Snacks', 8, 12, 'pack', 10],
  ['Clover Chips 60g', 'Chips & Snacks', 14, 20, 'pack', 5],
  ['V-Cut Spicy BBQ 60g', 'Chips & Snacks', 16, 22, 'pack', 5],
  ['Tortillos Cheese 40g', 'Chips & Snacks', 14, 20, 'pack', 5],
  ['Oishi Prawn Crackers (small)', 'Chips & Snacks', 8, 12, 'pack', 10],
  ['Oishi Pillows Chocolate 38g', 'Chips & Snacks', 11, 15, 'pack', 5],
  ["Oishi Marty's Cracklin' 90g", 'Chips & Snacks', 22, 28, 'pack', 5],
  ['Boy Bawang Cornick 100g', 'Chips & Snacks', 22, 28, 'pack', 5],
  ['Roller Coaster 60g', 'Chips & Snacks', 14, 20, 'pack', 5],
  ['Cheese Ring 60g', 'Chips & Snacks', 11, 15, 'pack', 5],
  ['Mr. Chips 60g', 'Chips & Snacks', 14, 20, 'pack', 5],
  ['Mang Juan Chicharon 60g', 'Chips & Snacks', 11, 15, 'pack', 5],
  ['Ding Dong Mixed Nuts (small)', 'Chips & Snacks', 8.5, 12, 'pack', 10],

  // Biscuits & crackers
  ['SkyFlakes Crackers', 'Biscuits', 8.5, 12, 'pack', 10],
  ['Fita Crackers', 'Biscuits', 8.5, 12, 'pack', 10],
  ['Rebisco Sandwich', 'Biscuits', 8.5, 12, 'pack', 10],
  ['Hansel Sandwich', 'Biscuits', 9, 13, 'pack', 10],
  ['Magic Flakes', 'Biscuits', 8.5, 12, 'pack', 10],
  ['Cream-O Sandwich', 'Biscuits', 8.5, 12, 'pack', 10],
  ['Presto Creams', 'Biscuits', 8, 11, 'pack', 10],
  ['Bingo Sandwich', 'Biscuits', 8, 11, 'pack', 10],
  ['M.Y. San Grahams', 'Biscuits', 9, 13, 'pack', 10],
  ['Fudgee Barr', 'Biscuits', 8.5, 12, 'pc', 10],

  // Candies & chocolates
  ['Choc-Nut', 'Candies', 1.5, 3, 'pc', 20],
  ['Cloud 9 Mini', 'Candies', 7, 10, 'pc', 10],
  ['Stick-O Junior', 'Candies', 10, 15, 'pc', 5],
  ['Mik-Mik Powdered Candy', 'Candies', 2.5, 5, 'pc', 20],
  ['Maxx Candy', 'Candies', 0.55, 1, 'pc', 50],
  ['White Rabbit Candy', 'Candies', 1.5, 3, 'pc', 20],
  ['Goya Chocolate Bar 35g', 'Candies', 18, 25, 'pc', 5],

  // Soft drinks
  ['Coke Mismo 295ml', 'Soft Drinks', 16.5, 22, 'bottle', 12],
  ['Sprite Mismo 295ml', 'Soft Drinks', 16.5, 22, 'bottle', 12],
  ['Royal Tru-Orange Mismo 295ml', 'Soft Drinks', 16.5, 22, 'bottle', 12],
  ['Pepsi Mismo 295ml', 'Soft Drinks', 16.5, 22, 'bottle', 12],
  ['Mountain Dew Mismo 295ml', 'Soft Drinks', 16.5, 22, 'bottle', 12],
  ['Coke Sakto 200ml', 'Soft Drinks', 13, 18, 'bottle', 12],
  ['RC Cola 250ml', 'Soft Drinks', 12, 17, 'bottle', 12],
  ['RC Cola 1L', 'Soft Drinks', 28, 38, 'bottle', 6],
  ['Pop Cola 250ml', 'Soft Drinks', 11, 15, 'bottle', 12],
  ['Coke 1.5L', 'Soft Drinks', 68, 85, 'bottle', 4],
  ['Sprite 1.5L', 'Soft Drinks', 68, 85, 'bottle', 4],
  ['Royal Tru-Orange 1.5L', 'Soft Drinks', 68, 85, 'bottle', 4],

  // Juice, tea & energy drinks
  ['C2 Green Tea Apple 500ml', 'Juice & Energy Drinks', 24, 30, 'bottle', 6],
  ['Zesto Juice 200ml', 'Juice & Energy Drinks', 9.5, 13, 'pack', 12],
  ['Sting Energy Drink 240ml', 'Juice & Energy Drinks', 22, 28, 'bottle', 6],
  ['Cobra Energy Drink 240ml', 'Juice & Energy Drinks', 18, 24, 'bottle', 6],
]

// JacqueNgel cafe menu (from the café website and Food Hub tarpaulin).
// Made to order: no stock counting. Costs are unknown, so they start at 0.
// [name, price, unit]
const cafe = [
  ['Iced Café Latte', 70, 'cup'],
  ['Iced Vanilla Latte', 85, 'cup'],
  ['Iced Caramel Latte', 85, 'cup'],
  ['Iced Hazelnut Latte', 85, 'cup'],
  ['Iced Mocha Latte', 85, 'cup'],
  ['Iced Butterscotch Latte', 85, 'cup'],
  ['Matcha Latte', 80, 'cup'],
  ['Strawberry Matcha Latte', 90, 'cup'],
  ['Thai Latte', 70, 'cup'],
  ['Mango Thai Latte', 80, 'cup'],
  ['Strawberry Milk', 75, 'cup'],
  ['Blueberry Milk', 75, 'cup'],
  ['Mango Milk', 75, 'cup'],
  ['Fruit Soda', 55, 'cup'],
  ['Nachos', 45, 'order'],
  ['Churros', 50, 'order'],
  ['French Fries', 40, 'order'],
  ['Siomai', 30, 'order'],
  ['Fishball', 20, 'order'],
  ['Kikiam', 20, 'order'],
  ['Ice Candy', 15, 'pc'],
]

export const STARTER_PRODUCTS = [
  ...rows.map(([name, category, cost, price, unit, lowStock]) => ({ name, category, cost, price, unit, lowStock })),
  ...cafe.map(([name, price, unit]) => ({
    name,
    category: 'Cafe',
    cost: 0,
    price,
    unit,
    lowStock: 0,
    madeToOrder: true,
  })),
]
