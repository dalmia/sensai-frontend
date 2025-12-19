import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskTypeMetricCard from '../../components/TaskTypeMetricCard';

describe('TaskTypeMetricCard Component', () => {
    const baseProps = {
        title: 'Quizzes',
        count: 10,
        completionRate: 0.75,
        color: 'blue' as const
    };

    it('should render the title correctly', () => {
        render(<TaskTypeMetricCard {...baseProps} />);
        expect(screen.getByText('Quizzes')).toBeInTheDocument();
    });

    it('should render the completion percentage correctly', () => {
        render(<TaskTypeMetricCard {...baseProps} />);
        expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should render the task count with plural suffix when count > 1', () => {
        render(<TaskTypeMetricCard {...baseProps} />);
        expect(screen.getByText('10 tasks')).toBeInTheDocument();
    });

    it('should render the task count with singular suffix when count = 1', () => {
        render(<TaskTypeMetricCard {...baseProps} count={1} />);
        expect(screen.getByText('1 task')).toBeInTheDocument();
    });

    it('should apply blue color classes when color is blue', () => {
        const { container } = render(<TaskTypeMetricCard {...baseProps} />);

        const title = screen.getByText('Quizzes');
        expect(title).toHaveClass('text-blue-600');
        expect(title).toHaveClass('dark:text-blue-400');

        // Check for the progress bar (inside the track)
        const progressTrack = container.querySelector('.h-2.w-full');
        const progressBar = progressTrack?.querySelector('div');
        expect(progressBar).toBeInTheDocument();
        expect(progressBar).toHaveClass('bg-blue-600');
        expect(progressBar).toHaveClass('dark:bg-blue-500');
    });

    it('should apply purple color classes when color is purple', () => {
        const { container } = render(
            <TaskTypeMetricCard {...baseProps} color="purple" />
        );

        const title = screen.getByText('Quizzes');
        expect(title).toHaveClass('text-purple-600');
        expect(title).toHaveClass('dark:text-purple-400');

        // Check for the progress bar (inside the track)
        const progressTrack = container.querySelector('.h-2.w-full');
        const progressBar = progressTrack?.querySelector('div');
        expect(progressBar).toBeInTheDocument();
        expect(progressBar).toHaveClass('bg-purple-600');
        expect(progressBar).toHaveClass('dark:bg-purple-500');
    });

    it('should set progress bar width based on completion rate', () => {
        const { container } = render(
            <TaskTypeMetricCard {...baseProps} completionRate={0.3} />
        );

        // Find the progress bar and check its width style
        const progressTrack = container.querySelector('.h-2.w-full');
        const progressBar = progressTrack?.querySelector('div');
        expect(progressBar).toHaveStyle('width: 30%');

        // Check the completion percentage text
        expect(screen.getByText('30%')).toBeInTheDocument();
    });

    it('should round the completion percentage to the nearest integer', () => {
        render(
            <TaskTypeMetricCard {...baseProps} completionRate={0.333} />
        );

        // 0.333 should round to 33%
        expect(screen.getByText('33%')).toBeInTheDocument();
    });
}); 