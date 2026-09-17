import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import WeeklyCalendar from '../components/WeeklyCalendar';

function getStartOfWeek(date) {
	const d = new Date(date);
	const day = d.getDay();
	const diff = day === 0 ? 6 : day - 1;
	d.setDate(d.getDate() - diff);
	d.setHours(0, 0, 0, 0);
	return d;
}

export default function WeeklyView() {
	const navigate = useNavigate();
	const [tasks, setTasks] = useState([]);
	const [weekStart, setWeekStart] = useState(() => getStartOfWeek(new Date()));
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		const load = async () => {
			setLoading(true);
			try {
				const { data } = await axios.get('/api/schedule/weekly', {
					params: { week_start: weekStart.toISOString() },
				});
				setTasks(Array.isArray(data) ? data : []);
			} catch (err) {
				console.error('Load weekly failed:', err);
				setTasks([]);
			} finally {
				setLoading(false);
			}
		};
		load();
	}, [weekStart]);

	const prevWeek = () => {
		const d = new Date(weekStart);
		d.setDate(d.getDate() - 7);
		setWeekStart(d);
	};

	const nextWeek = () => {
		const d = new Date(weekStart);
		d.setDate(d.getDate() + 7);
		setWeekStart(d);
	};

	const goToday = () => setWeekStart(getStartOfWeek(new Date()));

	return (
		<div style={{ minHeight: '100vh', background: '#f8fafc', padding: 24 }}>
			{/* Header */}
			<div style={{
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'center',
				marginBottom: 20,
			}}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
					{/* ปุ่มย้อนกลับ */}
					<button
						onClick={() => navigate('/schedule')}
						style={{
							padding: '8px 16px',
							background: '#fff',
							border: '1px solid #d1d5db',
							borderRadius: 20,
							cursor: 'pointer',
							fontWeight: 600,
							fontSize: 14,
							display: 'flex',
							alignItems: 'center',
							gap: 6,
						}}
					>
						◀ ย้อนกลับ
					</button>
					<h2 style={{ margin: 0 }}>ตารางรายสัปดาห์</h2>
				</div>

				<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
					<button onClick={prevWeek} style={navBtnStyle}>◀</button>
					<span style={{ fontWeight: 600, fontSize: 15, minWidth: 180, textAlign: 'center' }}>
						{weekStart.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} -{' '}
						{new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
					</span>
					<button onClick={nextWeek} style={navBtnStyle}>▶</button>
					<button onClick={goToday} style={{ ...navBtnStyle, padding: '6px 14px' }}>
						สัปดาห์นี้
					</button>
				</div>
			</div>

			{loading && <p>กำลังโหลด...</p>}

			<div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
				<WeeklyCalendar tasks={tasks} weekStart={weekStart} />
			</div>
		</div>
	);
}

const navBtnStyle = {
	padding: '8px 14px',
	background: '#fff',
	border: '1px solid #d1d5db',
	borderRadius: 20,
	cursor: 'pointer',
	fontWeight: 600,
	fontSize: 13,
};