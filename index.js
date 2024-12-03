const express = require('express');
const cron = require('node-cron');
const fs = require('fs');
const moment = require('moment'); // Install this with `npm install moment`

const app = express();
app.use(express.json());

let categories = ['Water', 'Food', 'Shopping'];
let expenses = [];

// Function to generate summaries
const generateSummary = (type) => {
  let summary;

  if (type === 'daily') {
    summary = expenses.reduce((result, item) => {
      const date = item.date; // Group by date
      if (!result[date]) {
        result[date] = { totalAmount: 0, count: 0 };
      }
      result[date].totalAmount += item.amount;
      result[date].count += 1;
      return result;
    }, {});
  } else if (type === 'weekly') {
    summary = expenses.reduce((result, item) => {
      const week = moment(item.date).format('YYYY-[W]WW'); // Get week number
      if (!result[week]) {
        result[week] = { totalAmount: 0, count: 0 };
      }
      result[week].totalAmount += item.amount;
      result[week].count += 1;
      return result;
    }, {});
  } else if (type === 'monthly') {
    summary = expenses.reduce((result, item) => {
      const month = item.date.slice(0, 7); // Extract YYYY-MM from date
      if (!result[month]) {
        result[month] = { totalAmount: 0, count: 0 };
      }
      result[month].totalAmount += item.amount;
      result[month].count += 1;
      return result;
    }, {});
  }

  // Save summary to a file
  fs.writeFileSync(`${type}_summary.json`, JSON.stringify(summary, null, 2));
  console.log(`${type} summary saved.`);
};

// Cron jobs
cron.schedule('0 0 * * *', () => generateSummary('daily')); // Run daily at midnight
cron.schedule('0 0 * * 0', () => generateSummary('weekly')); // Run weekly at midnight every Sunday
cron.schedule('0 0 1 * *', () => generateSummary('monthly')); // Run monthly on the 1st at midnight

// Add expense
app.post('/addexpense', (req, resp) => {
  const { category, amount, date } = req.body;

  // Validate inputs
  if (!category || !amount || !date) {
    return resp.status(400).send({ error: 'Invalid input: Category, Amount, and Date are required.' });
  } else if (amount < 0) {
    return resp.status(400).send({ error: 'Amount cannot be negative.' });
  } else if (!categories.includes(category)) {
    return resp.status(400).send({ error: 'Invalid Category.' });
  } else if (isNaN(Date.parse(date))) {
    return resp.status(400).send({ error: 'Invalid Date format.' });
  }

  const expense = {
    category,
    amount: parseFloat(amount), // Ensure amount is a number
    date
  };
  expenses.push(expense);
  fs.appendFileSync("./expenses.txt", JSON.stringify(expense) + '\n', 'utf-8');
  resp.send({ status: 'Added expense successfully', data: expense });
});

// Add category
app.post('/addCategory', (req, resp) => {
  const category  = req.body.category;
  if (!category) {
    return resp.status(400).send({ error: 'Category name is required.' });
  } else if (categories.includes(category)) {
    return resp.status(400).send({ error: 'Category already exists.' });
  }

  categories.push(category);
  resp.status(200).send({ status: 'Added category successfully', data: category });
});

// Get all expenses
app.get('/getexpenses', (req, resp) => {
  resp.send(expenses);
});

// Get expense analysis
app.get('/getexpenseanalysis', (req, resp) => {
  try {
    // Group by category
    const categoryBased = expenses.reduce((result, item) => {
      if (!result[item.category]) {
        result[item.category] = { totalAmount: 0, count: 0 };
      }
      result[item.category].totalAmount += item.amount;
      result[item.category].count += 1;
      return result;
    }, {});

    const categoryAnalysis = Object.entries(categoryBased).map(([category, data]) => ({
      category,
      totalAmount: data.totalAmount,
      averageAmount: data.totalAmount / data.count
    }));

    // Group by date
    const dateBased = expenses.reduce((result, item) => {
      if (!result[item.date]) {
        result[item.date] = { totalAmount: 0, count: 0 };
      }
      result[item.date].totalAmount += item.amount;
      result[item.date].count += 1;
      return result;
    }, {});

    const dateAnalysis = Object.entries(dateBased).map(([date, data]) => ({
      date,
      totalAmount: data.totalAmount,
      averageAmount: data.totalAmount / data.count
    }));

    resp.send({ categoryAnalysis, dateAnalysis });
  } catch (error) {
    resp.status(500).json({ error: 'An error occurred while processing data.' });
  }
});

// Start the server
app.listen(1234, () => {
  console.log('Listening on port 1234');
});
