const productsService = require("../services/products.service");

/**
 * Handles the list operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function list(req, res) {
  const result = await productsService.listProducts(req.query);
  res.json({ success: true, ...result });
}

/**
 * Handles the getById operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function getById(req, res) {
  const product = await productsService.getProductById(req.params.id);
  res.json({ success: true, product });
}

/**
 * Handles the create operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function create(req, res) {
  const product = await productsService.createProduct(req.body, req.auth.sub);
  res.status(201).json({ success: true, product });
}

/**
 * Handles the update operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function update(req, res) {
  const product = await productsService.updateProduct(req.params.id, req.body, req.auth);
  res.json({ success: true, product });
}

/**
 * Handles the remove operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function remove(req, res) {
  const result = await productsService.deleteProduct(req.params.id, req.auth);
  res.json({ success: true, message: result.message });
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
};
