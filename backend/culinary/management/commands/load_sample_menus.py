from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core.models import ProductionSettings
from culinary.models import Ingredient, MenuItem

# Marks the items this command made, so running it again replaces only those.
SAMPLE_NOTE = "Sample menu (placeholder for the Culinary team to replace)."

B, L, D, S = MenuItem.Meal.BREAKFAST, MenuItem.Meal.LUNCH, MenuItem.Meal.DINNER, MenuItem.Meal.SNACK

# One day per row: breakfast, lunch, dinner and the afternoon snack. Each dish
# is (name, ingredients), each ingredient "name | quantity | category". Sized
# for about 40 crew.
DAYS = [
    [
        (B, "Scrambled eggs, bacon and home fries", ["Eggs | 10 dozen | dairy", "Bacon | 8 lb | meat", "Russet potatoes | 15 lb | produce", "Yellow onions | 3 lb | produce", "Butter | 2 lb | dairy", "Orange juice | 4 gal | beverages"]),
        (L, "Grilled chicken Caesar wraps", ["Chicken breast | 12 lb | meat", "Romaine hearts | 12 heads | produce", "Flour tortillas (12 in) | 50 | bakery", "Parmesan | 2 lb | dairy", "Caesar dressing | 1 gal | pantry"]),
        (D, "Beef chili with cornbread", ["Ground beef | 15 lb | meat", "Kidney beans | 12 cans | pantry", "Crushed tomatoes | 10 cans | pantry", "Yellow onions | 5 lb | produce", "Cornbread mix | 8 boxes | pantry", "Shredded cheddar | 5 lb | dairy", "Sour cream | 4 lb | dairy"]),
        (S, "Apple slices and peanut butter cups", ["Gala apples | 40 | produce", "Peanut butter cups (single-serve) | 50 | pantry", "Sunflower butter cups (nut-free) | 10 | dietary"]),
    ],
    [
        (B, "Oatmeal bar with fruit and toppings", ["Rolled oats | 10 lb | pantry", "Bananas | 40 | produce", "Blueberries | 6 pints | produce", "Brown sugar | 3 lb | pantry", "Oat milk | 2 gal | dietary", "Whole milk | 3 gal | dairy"]),
        (L, "Turkey club sandwiches and kettle chips", ["Sliced turkey | 12 lb | meat", "Bacon | 6 lb | meat", "Sourdough bread | 10 loaves | bakery", "Tomatoes | 8 lb | produce", "Green leaf lettuce | 8 heads | produce", "Kettle chips (single-serve) | 50 | pantry"]),
        (D, "Chicken teriyaki rice bowls", ["Chicken thighs | 16 lb | meat", "Jasmine rice | 15 lb | pantry", "Teriyaki sauce | 1 gal | pantry", "Broccoli florets | 10 lb | produce", "Carrots | 5 lb | produce", "Green onions | 6 bunches | produce"]),
        (S, "Trail mix and string cheese", ["Trail mix | 6 lb | pantry", "String cheese | 50 | dairy", "Pretzel snack packs (nut-free) | 15 | pantry"]),
    ],
    [
        (B, "Breakfast burritos with salsa", ["Eggs | 10 dozen | dairy", "Breakfast sausage | 8 lb | meat", "Flour tortillas (12 in) | 50 | bakery", "Shredded Mexican cheese | 5 lb | dairy", "Salsa | 1 gal | pantry", "Russet potatoes | 10 lb | produce"]),
        (L, "Pulled pork sliders with coleslaw", ["Pork shoulder | 20 lb | meat", "Slider buns | 80 | bakery", "BBQ sauce | 1 gal | pantry", "Coleslaw mix | 8 lb | produce", "Mayonnaise | 1 gal | pantry"]),
        (D, "Baked salmon, wild rice and green beans", ["Salmon fillets | 15 lb | meat", "Wild rice blend | 10 lb | pantry", "Green beans | 10 lb | produce", "Lemons | 15 | produce", "Garlic | 6 heads | produce", "Olive oil | 1 L | pantry"]),
        (S, "Hummus with veggies and pita chips", ["Hummus | 6 lb | dairy", "Baby carrots | 6 lb | produce", "Cucumbers | 10 | produce", "Pita chips | 4 lb | pantry"]),
    ],
    [
        (B, "Pancakes, turkey sausage and berries", ["Pancake mix | 10 lb | pantry", "Turkey sausage links | 8 lb | meat", "Maple syrup | 1 gal | pantry", "Strawberries | 8 lb | produce", "Butter | 2 lb | dairy", "Gluten-free pancake mix | 2 lb | dietary"]),
        (L, "Build-your-own taco bar", ["Ground turkey | 12 lb | meat", "Taco seasoning | 10 packets | pantry", "Corn tortillas | 100 | bakery", "Black beans | 10 cans | pantry", "Shredded lettuce | 5 lb | produce", "Pico de gallo | 6 lb | produce", "Shredded cheddar | 4 lb | dairy"]),
        (D, "Spaghetti and meatballs with garlic bread", ["Spaghetti | 12 lb | pantry", "Frozen meatballs | 15 lb | frozen", "Marinara sauce | 3 gal | pantry", "Garlic bread | 8 loaves | bakery", "Parmesan | 2 lb | dairy", "Gluten-free spaghetti | 2 lb | dietary"]),
        (S, "Fruit cups and granola bars", ["Mixed fruit cups | 50 | produce", "Granola bars | 50 | pantry"]),
    ],
    [
        (B, "Bagels, cream cheese and fruit", ["Assorted bagels | 4 dozen | bakery", "Cream cheese | 5 lb | dairy", "Cantaloupe | 4 | produce", "Honeydew | 4 | produce", "Hard-boiled eggs | 4 dozen | dairy"]),
        (L, "Greek chicken salad bowls", ["Chicken breast | 12 lb | meat", "Romaine hearts | 10 heads | produce", "Cucumbers | 12 | produce", "Cherry tomatoes | 8 pints | produce", "Feta | 3 lb | dairy", "Kalamata olives | 2 lb | pantry", "Greek dressing | 1 gal | pantry"]),
        (D, "BBQ ribs, mac and cheese and corn", ["Pork baby back ribs | 25 lb | meat", "BBQ sauce | 1 gal | pantry", "Elbow macaroni | 8 lb | pantry", "Shredded cheddar | 6 lb | dairy", "Whole milk | 2 gal | dairy", "Corn on the cob | 45 | produce"]),
        (S, "Popcorn and sparkling water", ["Microwave popcorn | 40 bags | pantry", "Sparkling water | 4 cases | beverages"]),
    ],
    [
        (B, "Yogurt parfaits and breakfast sandwiches", ["Greek yogurt | 12 lb | dairy", "Granola | 5 lb | pantry", "Mixed berries | 8 lb | produce", "English muffins | 4 dozen | bakery", "Eggs | 5 dozen | dairy", "Sliced ham | 5 lb | meat"]),
        (L, "Italian subs and pasta salad", ["Sub rolls | 45 | bakery", "Salami | 5 lb | meat", "Ham | 5 lb | meat", "Provolone | 4 lb | dairy", "Rotini | 6 lb | pantry", "Italian dressing | 1 gal | pantry", "Bell peppers | 10 | produce"]),
        (D, "Chicken fajitas with rice and beans", ["Chicken breast | 16 lb | meat", "Bell peppers | 20 | produce", "Yellow onions | 8 lb | produce", "Flour tortillas (8 in) | 100 | bakery", "Spanish rice mix | 8 boxes | pantry", "Refried beans | 10 cans | pantry", "Guacamole | 5 lb | produce"]),
        (S, "Cheese and cracker plates", ["Cheddar cubes | 4 lb | dairy", "Pepper jack cubes | 3 lb | dairy", "Assorted crackers | 6 boxes | pantry", "Grapes | 8 lb | produce"]),
    ],
    [
        (B, "French toast bake with bacon", ["Brioche loaves | 8 | bakery", "Eggs | 6 dozen | dairy", "Whole milk | 2 gal | dairy", "Cinnamon | 2 jars | pantry", "Bacon | 8 lb | meat", "Maple syrup | 1 gal | pantry"]),
        (L, "Burgers and veggie burgers with fries", ["Ground beef patties | 40 | meat", "Veggie burger patties | 10 | dietary", "Hamburger buns | 50 | bakery", "Frozen fries | 20 lb | frozen", "American cheese | 3 lb | dairy", "Tomatoes | 6 lb | produce", "Red onions | 4 | produce"]),
        (D, "Roast chicken, mashed potatoes and carrots", ["Whole chickens | 10 | meat", "Yukon gold potatoes | 20 lb | produce", "Carrots | 10 lb | produce", "Butter | 3 lb | dairy", "Heavy cream | 2 qt | dairy", "Fresh thyme | 4 bunches | produce"]),
        (S, "Smoothie cups", ["Frozen mixed berries | 10 lb | frozen", "Bananas | 30 | produce", "Vanilla yogurt | 8 lb | dairy", "Orange juice | 2 gal | beverages"]),
    ],
    [
        (B, "Veggie frittata and roasted potatoes", ["Eggs | 10 dozen | dairy", "Spinach | 4 lb | produce", "Bell peppers | 10 | produce", "Mushrooms | 4 lb | produce", "Red potatoes | 15 lb | produce", "Shredded mozzarella | 3 lb | dairy"]),
        (L, "Chicken noodle soup and grilled cheese", ["Chicken thighs | 10 lb | meat", "Egg noodles | 6 lb | pantry", "Chicken broth | 6 gal | pantry", "Celery | 4 bunches | produce", "Sliced white bread | 10 loaves | bakery", "American cheese | 5 lb | dairy"]),
        (D, "Shrimp stir-fry with noodles", ["Shrimp (peeled) | 15 lb | meat", "Lo mein noodles | 10 lb | pantry", "Stir-fry vegetable mix | 15 lb | frozen", "Soy sauce | 1 gal | pantry", "Fresh ginger | 1 lb | produce", "Tofu (shellfish-free option) | 6 lb | dietary"]),
        (S, "Banana bread and coffee", ["Banana bread loaves | 6 | bakery", "Ground coffee | 3 lb | beverages", "Half-and-half | 1 gal | dairy"]),
    ],
    [
        (B, "Breakfast tacos", ["Eggs | 10 dozen | dairy", "Chorizo | 6 lb | meat", "Corn tortillas | 100 | bakery", "Avocados | 15 | produce", "Queso fresco | 3 lb | dairy", "Salsa verde | 1 gal | pantry"]),
        (L, "Chicken Cobb salad", ["Chicken breast | 12 lb | meat", "Bacon | 5 lb | meat", "Romaine hearts | 12 heads | produce", "Hard-boiled eggs | 4 dozen | dairy", "Avocados | 15 | produce", "Blue cheese crumbles | 2 lb | dairy", "Ranch dressing | 1 gal | pantry"]),
        (D, "Beef lasagna and Caesar salad", ["Ground beef | 12 lb | meat", "Lasagna noodles | 8 lb | pantry", "Ricotta | 8 lb | dairy", "Shredded mozzarella | 8 lb | dairy", "Marinara sauce | 3 gal | pantry", "Romaine hearts | 8 heads | produce", "Caesar dressing | 2 qt | pantry"]),
        (S, "Chips and guacamole", ["Tortilla chips | 6 lb | pantry", "Guacamole | 6 lb | produce", "Salsa | 2 qt | pantry"]),
    ],
    [
        (B, "Biscuits and gravy with fruit", ["Frozen biscuits | 6 dozen | frozen", "Breakfast sausage | 10 lb | meat", "Whole milk | 3 gal | dairy", "All-purpose flour | 2 lb | pantry", "Mixed fruit | 10 lb | produce"]),
        (L, "Buffalo chicken wraps and celery", ["Breaded chicken tenders | 15 lb | frozen", "Buffalo sauce | 2 qt | pantry", "Flour tortillas (12 in) | 50 | bakery", "Celery | 6 bunches | produce", "Ranch dressing | 2 qt | pantry", "Shredded lettuce | 4 lb | produce"]),
        (D, "Pork tenderloin, sweet potatoes and broccoli", ["Pork tenderloin | 15 lb | meat", "Sweet potatoes | 20 lb | produce", "Broccoli florets | 10 lb | produce", "Brown sugar | 2 lb | pantry", "Dijon mustard | 1 qt | pantry"]),
        (S, "Veggie cups with ranch", ["Baby carrots | 5 lb | produce", "Celery | 4 bunches | produce", "Snap peas | 4 lb | produce", "Ranch dip cups | 50 | dairy"]),
    ],
    [
        (B, "Avocado toast and hard-boiled eggs", ["Multigrain bread | 10 loaves | bakery", "Avocados | 25 | produce", "Hard-boiled eggs | 6 dozen | dairy", "Cherry tomatoes | 6 pints | produce", "Everything bagel seasoning | 2 jars | pantry"]),
        (L, "Meatball subs and side salad", ["Frozen meatballs | 15 lb | frozen", "Sub rolls | 45 | bakery", "Marinara sauce | 2 gal | pantry", "Shredded mozzarella | 5 lb | dairy", "Spring mix | 5 lb | produce", "Balsamic dressing | 2 qt | pantry"]),
        (D, "Chicken curry with basmati rice and naan", ["Chicken thighs | 16 lb | meat", "Curry paste | 4 jars | pantry", "Coconut milk | 12 cans | pantry", "Basmati rice | 15 lb | pantry", "Naan | 50 | bakery", "Chickpeas (vegetarian option) | 8 cans | pantry"]),
        (S, "Cookies and cold brew", ["Assorted cookies | 6 dozen | bakery", "Cold brew concentrate | 2 gal | beverages", "Gluten-free cookies | 1 dozen | dietary"]),
    ],
    [
        (B, "Waffles with fruit and whipped cream", ["Waffle mix | 10 lb | pantry", "Strawberries | 8 lb | produce", "Whipped cream | 4 cans | dairy", "Maple syrup | 1 gal | pantry", "Turkey bacon | 6 lb | meat"]),
        (L, "Poke bowls", ["Sushi-grade tuna | 10 lb | meat", "Sushi rice | 12 lb | pantry", "Edamame | 6 lb | frozen", "Cucumbers | 12 | produce", "Seaweed salad | 4 lb | produce", "Spicy mayo | 1 qt | pantry", "Teriyaki chicken (no-fish option) | 6 lb | meat"]),
        (D, "Steak, baked potatoes and Caesar salad", ["Sirloin steaks | 40 | meat", "Russet potatoes | 40 | produce", "Sour cream | 4 lb | dairy", "Butter | 3 lb | dairy", "Romaine hearts | 8 heads | produce", "Portobello caps (vegetarian option) | 10 | produce"]),
        (S, "Mixed nuts and dried fruit", ["Mixed nuts | 6 lb | pantry", "Dried mango | 3 lb | pantry", "Seed and fruit packs (nut-free) | 15 | dietary"]),
    ],
    [
        (B, "Breakfast sandwiches on croissants", ["Croissants | 4 dozen | bakery", "Eggs | 8 dozen | dairy", "Sliced cheddar | 4 lb | dairy", "Bacon | 8 lb | meat", "Fresh fruit salad | 10 lb | produce"]),
        (L, "Black bean burrito bowls", ["Black beans | 15 cans | pantry", "Cilantro-lime rice | 12 lb | pantry", "Corn | 6 lb | frozen", "Pico de gallo | 6 lb | produce", "Shredded chicken | 10 lb | meat", "Queso | 1 gal | dairy"]),
        (D, "Fried chicken, collard greens and biscuits", ["Chicken drumsticks and thighs | 25 lb | meat", "All-purpose flour | 10 lb | pantry", "Buttermilk | 2 gal | dairy", "Collard greens | 10 lb | produce", "Smoked turkey wings | 4 lb | meat", "Frozen biscuits | 4 dozen | frozen"]),
        (S, "Rice crispy treats and lemonade", ["Rice crispy treats | 50 | pantry", "Lemonade | 4 gal | beverages"]),
    ],
    [
        (B, "Brunch buffet: quiche, fruit and pastries", ["Frozen quiche | 8 | frozen", "Assorted pastries | 4 dozen | bakery", "Pineapples | 4 | produce", "Grapes | 6 lb | produce", "Orange juice | 4 gal | beverages"]),
        (L, "Grilled veggie and chicken flatbreads", ["Flatbreads | 40 | bakery", "Chicken breast | 10 lb | meat", "Zucchini | 10 | produce", "Red onions | 5 | produce", "Pesto | 2 qt | pantry", "Shredded mozzarella | 5 lb | dairy"]),
        (D, "Sunday pot roast with vegetables", ["Chuck roast | 25 lb | meat", "Carrots | 10 lb | produce", "Yukon gold potatoes | 20 lb | produce", "Celery | 4 bunches | produce", "Beef broth | 3 gal | pantry", "Dinner rolls | 5 dozen | bakery"]),
        (S, "Brownies and fresh berries", ["Brownies | 50 | bakery", "Mixed berries | 6 lb | produce"]),
    ],
]


class Command(BaseCommand):
    help = (
        "Adds sample Culinary menus (breakfast, lunch, dinner and an afternoon snack) for this week and next, "
        "Monday to Sunday, with ingredients. No shopping lists. Running it again replaces only its own items."
    )

    def add_arguments(self, parser):
        parser.add_argument("--remove", action="store_true", help="Remove the sample menus instead of adding them.")

    @transaction.atomic
    def handle(self, *args, remove=False, **options):
        # This week and next, Monday to Sunday, in the production's time zone.
        today = timezone.localdate(timezone=ProductionSettings.load().zone)
        monday = today - timedelta(days=today.weekday())
        days = [monday + timedelta(days=n) for n in range(14)]

        removed, _ = MenuItem.objects.filter(notes=SAMPLE_NOTE, date__in=days).delete()
        if remove:
            self.stdout.write(f"Removed the sample menus ({removed} rows).")
            return

        made = 0
        for day, dishes in zip(days, DAYS):
            for meal, name, ingredients in dishes:
                item = MenuItem.objects.create(name=name, date=day, meal=meal, notes=SAMPLE_NOTE)
                Ingredient.objects.bulk_create(
                    [
                        Ingredient(menu_item=item, name=n, quantity=q, category=c, position=position)
                        for position, (n, q, c) in enumerate(
                            [part.strip() for part in ingredient.split("|")] for ingredient in ingredients
                        )
                    ]
                )
                made += 1
        self.stdout.write(f"Sample menus: {made} menu items from {days[0]:%b %d} to {days[-1]:%b %d}")
