import React, { useState, useRef, useEffect } from 'react';
import '../../styles/chatbot.css';

const Chatbot = ({ onGeometryGenerated, isOpen, onToggle }) => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi! I can help you design pedestrian simulation scenarios. Ask me questions or tell me to create geometry like "draw a corridor with agents spawning on the left and exit on the right".'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const fetchURL = process.env.REACT_APP_BACKEND_API || 'http://localhost:8000';
      const response = await fetch(`${fetchURL}/chatbot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          conversation_history: messages
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.response 
      }]);

      if (data.has_geometry && data.wkt && data.json_config) {
        onGeometryGenerated(data.json_config, data.wkt);
      }

    } catch (error) {
      console.error('Chatbot error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([{
      role: 'assistant',
      content: 'Hi! I can help you design pedestrian simulation scenarios. Ask me questions or tell me to create geometry like "draw a corridor with agents spawning on the left and exit on the right".'
    }]);
  };

  return (
    <>
      {/* Floating Button */}
      <button 
        className={`chatbot-fab ${isOpen ? 'open' : ''}`}
        onClick={onToggle}
        title={isOpen ? "Close AI Assistant" : "Open AI Assistant"}
      >
        {isOpen ? '✕' : '🤖'}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <div className="chatbot-header-content">
              <div className="chatbot-icon">🤖</div>
              <div>
                <h3 className="chatbot-title">AI Assistant</h3>
                <p className="chatbot-subtitle">Powered by Gemini</p>
              </div>
            </div>
            <div className="chatbot-header-actions">
              <button 
                onClick={handleClear}
                className="chatbot-btn-icon"
                title="Clear conversation"
              >
                🔄
              </button>
              <button 
                onClick={onToggle}
                className="chatbot-btn-icon"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="chatbot-messages">
            {messages.map((message, index) => (
              <div 
                key={index} 
                className={`chatbot-message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
              >
                <div className="message-avatar">
                  {message.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className="message-content">
                  {message.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="chatbot-message assistant-message">
                <div className="message-avatar">🤖</div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="chatbot-input-form">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              className="chatbot-input"
              disabled={isLoading}
            />
            <button 
              type="submit" 
              className="chatbot-btn-send"
              disabled={isLoading || !input.trim()}
            >
              {isLoading ? '...' : '➤'}
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default Chatbot;