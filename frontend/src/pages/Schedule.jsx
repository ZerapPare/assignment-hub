import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

import Sidebar from '../components/Sidebar';
import TaskList from '../components/TaskList';
import LunchTimeSetting from '../components/LunchTimeSetting';
import AutoScheduleButton from '../components/AutoScheduleButton';
import { GridIcon } from '../icons';

import './Schedule.css';

export default function Schedule({ student, onLogout }) {
	const navigate = useNavigate();

	const [assignments, setAssignments] = useState([]);
	const [scheduleSettings, setScheduleSettings] = useState(null);
	const [taskDurations, setTaskDurations] = useState({});
	const [toast, setToast] = useState(null);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);

	const load = async () => {
		try {
			const { data } = await axios.get('/api/assignments?filter=active');
			setAssignments(Array.isArray(data) ? data : []);
		} catch (err) {
			console.error('Load failed:', err);
		}
	};

	useEffect(() => {
		load();
	}, []);

	const showToast = (message, type = 'success') => {
		setToast({ message, type });

		setTimeout(() => {
			setToast(null);
		}, 3500);
	};

	const handleGenerated = (result) => {
		load();

		if (result?.error) {
			showToast(result.message, 'error');
			return;
		}

		showToast(
			result?.message || 'จัดตารางเรียบร้อยแล้ว',
			result?.failed > 0 ? 'error' : 'success'
		);
	};

	const handleSettingsChange = useCallback((settings) => {
		setScheduleSettings(settings);
	}, []);

	const handleDurationsChange = useCallback((durations) => {
		setTaskDurations(durations);
	}, []);

	const saveAll = async () => {
		setSaving(true);

		try {
			const requests = [];

			if (scheduleSettings) {
				const { workingHours, lunch } = scheduleSettings;
				const workingHoursPayload = {};

				for (let d = 0; d < 7; d++) {
					if (workingHours[d]) {
						workingHoursPayload[String(d)] = `${workingHours[d]}:00`;
					}
				}

				requests.push(
					axios.put(
						'/api/user/working-hours',
						workingHoursPayload
					)
				);

				requests.push(
					axios.put('/api/user/settings', {
						lunch_start: `${lunch.lunch_start}:00`,
						lunch_end: `${lunch.lunch_end}:00`,
					})
				);
			}

			assignments.forEach((task) => {
				const duration = taskDurations[task.assignment_id];

				if (!duration) return;

				const total = duration.hours * 60 + duration.minutes;

				requests.push(
					axios.patch(
						`/api/tasks/${task.assignment_id}/duration`,
						{
							time_estimate: Math.max(5, total),
						}
					)
				);
			});

			await Promise.all(requests);

			setSaved(true);
			showToast('บันทึกการตั้งค่าเรียบร้อยแล้ว');

			setTimeout(() => {
				setSaved(false);
			}, 2000);

			await load();
		} catch (err) {
			console.error('Save failed:', err);

			showToast(
				'บันทึกไม่สำเร็จ: ' +
					(err.response?.data?.error || err.message),
				'error'
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="schedule-page">
			<Sidebar
				active="schedule"
				student={student}
				onLogout={onLogout}
			/>

			<main className="schedule-main">
				<header className="schedule-header">
					<div>
						<h1>ระบบจัดตาราง</h1>
						<p>
							ตั้งเวลาทำงาน กำหนดเวลาที่ใช้กับงาน
							และจัดตารางงานอัตโนมัติ
						</p>
					</div>

					<button
						className="weekly-button"
						onClick={() => navigate('/weekly')}
					>
						<GridIcon size={16} color="#fff" />
						ดูตารางรายสัปดาห์
					</button>
				</header>

				<section className="schedule-card">
					<LunchTimeSetting
						onChange={handleSettingsChange}
					/>
				</section>

				<section className="schedule-card">
					<TaskList
						assignments={assignments}
						onUpdated={load}
						onDurationsChange={handleDurationsChange}
					/>
				</section>
			</main>

			<div className="schedule-actions">
				<button
					className="save-button"
					onClick={saveAll}
					disabled={saving}
				>
					บันทึก
				</button>

				<AutoScheduleButton
					onGenerated={handleGenerated}
				/>
			</div>

			{toast && (
				<div
					className={`schedule-toast ${
						toast.type === 'error'
							? 'toast-error'
							: 'toast-success'
					}`}
				>
					<span>
						{toast.type === 'error' ? '✕' : '✓'}
					</span>

					<div>{toast.message}</div>
				</div>
			)}
		</div>
	);
}