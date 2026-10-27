/**
 * Функция расчёта выручки с учётом скидки.
 */
function calculateSimpleRevenue(purchase, _product) {
    // 1. Переводим скидку из процентов в десятичный коэффициент
    const discountCoefficient = 1 - (purchase.discount / 100);
    
    // 2 & 3. Считаем полную стоимость и применяем скидку
    return purchase.sale_price * purchase.quantity * discountCoefficient;
}

/**
 * Функция расчёта бонуса от позиции в рейтинге по прибыли.
 */
function calculateBonusByProfit(index, total, seller) {
    const { profit } = seller;
    let bonusPercentage = 0;

    if (index === 0) {
        bonusPercentage = 0.15; // 15% для первого места
    } else if (index === 1 || index === 2) {
        bonusPercentage = 0.10; // 10% для второго и третьего
    } else if (index === total - 1) {
        bonusPercentage = 0;    // 0% для последнего места
    } else {
        bonusPercentage = 0.05; // 5% для всех остальных
    }

    return profit * bonusPercentage;
}

/**
 * Главная функция анализа данных о продажах.
 */
function analyzeSalesData(data, options) {
    // 1. Проверка входных данных
    if (!data 
        || !Array.isArray(data.sellers) || data.sellers.length === 0
        || !Array.isArray(data.products) || data.products.length === 0
        || !Array.isArray(data.purchase_records) || data.purchase_records.length === 0
    ) {
        throw new Error('Некорректные входные данные');
    }

    // 2. Проверка наличия опций и функций в них
    if (!options 
        || typeof options !== 'object'
        || typeof options.calculateRevenue !== 'function' 
        || typeof options.calculateBonus !== 'function'
    ) {
        throw new Error('Не переданы обязательные функции для расчёта (options)');
    }

    const { calculateRevenue, calculateBonus } = options;

    // 3. Подготовка промежуточных данных для сбора статистики
    const sellerStats = data.sellers.map(seller => ({
        id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        products_sold: {}
    }));

    // 4. Индексация продавцов и товаров для быстрого доступа
    const sellerIndex = sellerStats.reduce((result, item) => ({
        ...result,
        [item.id]: item
    }), {});

    const productIndex = data.products.reduce((result, item) => ({
        ...result,
        [item.sku]: item
    }), {});

    // 5. Расчёт выручки и прибыли для каждого продавца
    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];
        
        if (!seller) return; // Защита от чеков с неизвестными продавцами

        seller.sales_count += 1;
        seller.revenue += record.total_amount;

        record.items.forEach(item => {
            const product = productIndex[item.sku];
            
            if (!product) return;

            // Расчет себестоимости, выручки и прибыли
            const cost = product.purchase_price * item.quantity;
            const revenue = calculateRevenue(item, product);
            const profit = revenue - cost;

            seller.profit += profit;

            // Учёт количества проданных товаров
            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            seller.products_sold[item.sku] += item.quantity;
        });
    });

    // 6. Сортировка продавцов по прибыли (по убыванию)
    sellerStats.sort((a, b) => b.profit - a.profit);

    // 7. Назначение премий на основе ранжирования и формирование топ-10 товаров
    const totalSellers = sellerStats.length;
    
    sellerStats.forEach((seller, index) => {
        seller.bonus = calculateBonus(index, totalSellers, seller);

        // Формирование топ-10 товаров
        const productsArray = Object.entries(seller.products_sold).map(([sku, quantity]) => ({
            sku,
            quantity
        }));
        
        // Сортировка товаров по количеству (по убыванию)
        productsArray.sort((a, b) => b.quantity - a.quantity);
        
        seller.top_products = productsArray.slice(0, 10);
    });

    // 8. Подготовка итоговой коллекции с нужными полями
    return sellerStats.map(seller => ({
        seller_id: seller.id,
        name: seller.name,
        revenue: +(seller.revenue.toFixed(2)),
        profit: +(seller.profit.toFixed(2)),
        sales_count: seller.sales_count,
        top_products: seller.top_products,
        bonus: +(seller.bonus.toFixed(2))
    }));
}