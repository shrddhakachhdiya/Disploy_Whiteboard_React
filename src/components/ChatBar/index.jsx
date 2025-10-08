import { SendHorizonalIcon, X, MessageCircle } from 'lucide-react';
import React, { useEffect, useRef } from 'react'
import { useState } from 'react'
import './index.css';

const Chat = ({ setOpenedChatBar, socket, chat, setChat, openedChatBar }) => {
    const [message, setMessage] = useState("");
    const chatBarRef = useRef(null);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chat]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (chatBarRef.current && !chatBarRef.current.contains(event.target)) {
                setOpenedChatBar(false);
            }
        }
        const timer = setTimeout(() => {
            document.addEventListener("mousedown", handleClickOutside);
        }, 100);

        return () => {
            clearTimeout(timer);
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [setOpenedChatBar]);

    function handleSubmit(e) {
        e.preventDefault();
        if (message.trim() !== "") {
            socket.emit('message', { message });
            setChat(prevChats => [...prevChats, { message, name: "You" }]);
            setMessage("");
        }
    }

    return (
        <div
            ref={chatBarRef}
            className={`chat-container ${openedChatBar ? 'chat-open' : 'chat-closed'}`}
        >
            {/* Header */}
            <div className="chat-header">
                <div className="flex items-center space-x-3">
                    <div className="chat-icon">
                        <MessageCircle size={20} />
                    </div>
                    <div>
                        <h3 className="chat-title">Team Chat</h3>
                        <p className="chat-subtitle">{chat.length} messages</p>
                    </div>
                </div>
                <button
                    onClick={() => setOpenedChatBar(false)}
                    className="chat-close-btn"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Messages Area */}
            <div className="chat-messages">
                {chat.length === 0 ? (
                    <div className="empty-chat">
                        <MessageCircle size={48} className="text-gray-400" />
                        <p className="text-gray-500 mt-2">Start a conversation</p>
                    </div>
                ) : (
                    chat.map((msg, index) => (
                        <div
                            key={index * 999}
                            className={`message-wrapper ${msg.name === "You" ? 'message-sent' : 'message-received'}`}
                        >
                            <div className={`message-bubble ${msg.name === "You" ? 'bubble-sent' : 'bubble-received'}`}>
                                {msg.name !== "You" && (
                                    <div className="message-sender">{msg.name}</div>
                                )}
                                <div className="message-text">{msg.message}</div>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="chat-input-form">
                <div className="input-container">
                    <input
                        type="text"
                        placeholder='Type your message...'
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="chat-input"
                    />
                    <button
                        type="submit"
                        className="send-button"
                        disabled={!message.trim()}
                    >
                        <SendHorizonalIcon size={18} />
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Chat
