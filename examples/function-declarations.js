// Example with function declarations and function expressions

// Arrow function
const square = (x) => x * x;

// Function declaration
function add(a, b) {
  return a + b;
}

// Function expression
const multiply = function(x, y) {
  return x * y;
};

// Nested function call (from problem statement)
function calculate(b, c) {
  return square(c) + b - c;
}

// Use the functions
const sum = add(10, 20);
const product = multiply(5, 6);
const result = calculate(5, 3);
