const { compareDeadline } = require('../utils/dateHelpers');

// เรียงตาม 1) deadline  2) duration (สั้นก่อน)  3) priority สูงก่อน
function sortByPriority(tasks) {
	return [...tasks].sort((a, b) => {
		const d = compareDeadline(a.deadline, b.deadline);
		if (d !== 0) return d;
		if (a.duration_min !== b.duration_min)
			return a.duration_min - b.duration_min;
		return (b.priority || 0) - (a.priority || 0);
	});
}

module.exports = { sortByPriority };