import { useState } from 'react';
import axios from 'axios';

export default function AutoScheduleButton({ onGenerated }) {
	const [loading, setLoading] = useState(false);

	const generate = async () => {
		setLoading(true);
		try {
			const { data } = await axios.post('/api/schedule/generate');
			onGenerated?.(data);
		} catch (err) {
			console.error('Generate failed:', err);
			onGenerated?.({
				error: true,
				message: err.response?.data?.error || err.message,
			});
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="auto-schedule-wrapper">
			<button
				className="auto-schedule-button"
				onClick={generate}
				disabled={loading}
			>
				{loading ? 'กำลังจัดตาราง...' : 'จัดตารางอัตโนมัติ'}
			</button>
		</div>
	);
}