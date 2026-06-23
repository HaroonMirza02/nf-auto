import React from 'react';

const CountdownTimer = ({ countdown, isUrgent }) => {
    return (
        <div style={{
            textAlign: 'center',
            padding: '10px 0',
            fontSize: '14px',
            fontWeight: '600',
            color: isUrgent ? '#EF4444' : '#22C55E'
        }}>
            Closes in {countdown}
        </div>
    );
};

export default CountdownTimer;
