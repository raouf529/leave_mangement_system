import { useState, useEffect } from 'react';
import api from './api';
import useCurrentUser from '../hooks/useCurrentUser';

function MarkAttendance() {
  const { user } = useCurrentUser();
  const [attendanceMarked, setAttendanceMarked] = useState(false);
  const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            api.get('/attendence/my')
                .then((response) => {
                    const today = new Date().toISOString().split('T')[0];
                    const attendanceToday = response.data.find((attendance) => attendance.date === today);
                    setAttendanceMarked(!!attendanceToday);
                }
            )
        }
    }, [user]);

    const handleMarkAttendance = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            await api.post('/attendence/mark', { date: today, status: 'present' });
            setAttendanceMarked(true);
        }
        catch (error) {
            console.error('Error marking attendance:', error);
        }
    };

    if (loading) {
        return <div>Loading...</div>;
    }
    return (
        <div>
            {attendanceMarked ? (
                <p>Attendance for today has already been marked.</p>
            ) : (
                <button onClick={handleMarkAttendance}>Mark Attendance</button>
            )}
        </div>
    );
}