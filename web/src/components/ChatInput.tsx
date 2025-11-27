import { forwardRef } from 'react';
import './ChatInput.css';

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
    value: string;
    onChange: (value: string) => void;
}

export const ChatInput = forwardRef<HTMLInputElement, ChatInputProps>(
    ({ onSend, disabled, value, onChange }, ref) => {
        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            if (value.trim() && !disabled) {
                onSend(value.trim());
                onChange('');
            }
        };

        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
            }
        };

        return (
            <form className="chat-input-form" onSubmit={handleSubmit}>
                <input
                    ref={ref}
                    type="text"
                    className="chat-input"
                    placeholder="Ask me to swap tokens..."
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                />
                <button
                    type="submit"
                    className="chat-send-btn"
                    disabled={disabled || !value.trim()}
                >
                    Send
                </button>
            </form>
        );
    }
);

ChatInput.displayName = 'ChatInput';
