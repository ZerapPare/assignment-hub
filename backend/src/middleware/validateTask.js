const validateTask = (req, res, next) => {
	const { title, start_time, duration_min } = req.body;
	const errors = [];

	if (!title || typeof title !== 'string') errors.push('title ต้องเป็น string');
	if (!start_time || isNaN(new Date(start_time))) errors.push('start_time ไม่ถูกต้อง');
	if (!duration_min || duration_min <= 0) errors.push('duration_min ต้องมากกว่า 0');

	if (errors.length) return res.status(400).json({ errors });
	next();
};

module.exports = { validateTask };