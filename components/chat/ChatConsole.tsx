'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Conversation, Message, Customer, SocialIdentity } from '@/types';
// import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'; // DEPRECATED for this example to avoid error
import { createClient } from '@supabase/supabase-js';
import { Send, User, Bot, AlertCircle, Phone, Tag, Clock, MoreVertical, Search, CheckCircle2, XCircle } from 'lucide-react';

// Initialize Supabase Client manually to avoid crash if env is missing
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

// UI Components
const Badge = ({ color, text }: { color: string, text: string }) => {
  const styles = {
    teal: 'bg-teal-50 text-teal-700 border-teal-200',
    red: 'bg-rose-50 text-rose-700 border-rose-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    gray: 'bg-gray-100 text-gray-700 border-gray-200'
  };
  const selectedStyle = styles[color as keyof typeof styles] || styles.gray;
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wide border ${selectedStyle}`}>
      {text}
    </span>
  );
};

const Button = ({ children, onClick, variant = 'primary', className = '', disabled=false }: any) => {
  const baseStyle = "flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: 'bg-teal-600 text-white hover:bg-teal-700 shadow-sm hover:shadow active:scale-95',
    outline: 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300',
    danger: 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100',
    ghost: 'text-gray-500 hover:bg-gray-100'
  };
  // @ts-ignore
  return <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`}>{children}</button>;
};

export default function ChatConsole() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUserInput, setCurrentUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string|null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Conversations Data
  const fetchConversations = async () => {
    if (!supabase) {
        setIsLoading(false);
        setErrorMsg("⚠️ เชื่อมต่อ Database ไม่ได้: กรุณาใส่ Supabase URL/Key ในไฟล์ .env.local");
        return;
    }
  
    try {
      // Join tables: conversations -> social_identities -> customers
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          social_identities (
            *,
            customers (*)
          )
        `)
        .order('last_message_at', { ascending: false });

      if (error) throw error;
      
      // Transform data structure to match our Interface
      const formatted: Conversation[] = (data || []).map((item: any) => ({
        ...item,
        identity: item.social_identities,
        customer: item.social_identities?.customers,
        unread_count: 0 // In real app, calculate this
      }));
      
      setConversations(formatted);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Fetch Messages for Selected Conversation
  const fetchMessages = async (convId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    
    if (data) setMessages(data);
  };

  // Initial Load
  useEffect(() => {
    fetchConversations();

    if (!supabase) return;

    // Subscribe to NEW Conversations (Realtime)
    const channel = supabase
      .channel('conversations_channel')
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'conversations' }, 
        (payload) => {
           // Simple strategy: Re-fetch all to keep sort order and relations correct
           // In high-scale app, we should optimistically update state
           fetchConversations();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // On Selection Change
  useEffect(() => {
    if (selectedConvId) {
      fetchMessages(selectedConvId);
      
      if (!supabase) return;

      // Subscribe to NEW Messages (Realtime)
      const channel = supabase
        .channel(`messages:${selectedConvId}`)
        .on(
          'postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConvId}` }, 
          (payload) => {
             const newMsg = payload.new as Message;
             setMessages((prev) => [...prev, newMsg]);
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    } else {
      setMessages([]);
    }
  }, [selectedConvId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activeConversation = conversations.find(c => c.id === selectedConvId);

  // Send Message Action
  const handleSendMessage = async () => {
    if (!currentUserInput.trim() || !selectedConvId || !supabase) return;
    
    const text = currentUserInput;
    setCurrentUserInput(''); // Clear UI immediately

    // Insert into DB (Realtime will update the UI list)
    await supabase.from('messages').insert({
      conversation_id: selectedConvId,
      sender_type: 'agent',
      content_type: 'text',
      content: text
    });

    // Update conversation timestamp
    await supabase.from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', selectedConvId);
  };

  // Toggle AI Mode Action
  const toggleAIMode = async () => {
    if (!activeConversation) return;
    const newMode = !activeConversation.ai_mode;
    
    // Optimistic Update UI
    setConversations(prev => prev.map(c => 
      c.id === activeConversation.id ? { ...c, ai_mode: newMode } : c
    ));
    
    // Update DB
    await supabase
      .from('conversations')
      .update({ ai_mode: newMode })
      .eq('id', activeConversation.id);
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-slate-800">
      {/* 1. Sidebar Left: Conversation List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col shadow-sm z-10">
        <div className="p-4 border-b border-gray-100 bg-white backdrop-blur flex justify-between items-center sticky top-0">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="w-2 h-6 bg-teal-500 rounded-full"></span> Inbox
          </h2>
          <Button variant="ghost" className="!p-2"><Search size={18} /></Button>
        </div>
        
        {/* Error Banner */}
        {errorMsg && (
          <div className="bg-red-50 border-b border-red-100 p-2 text-xs text-red-700 text-center">
            {errorMsg}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {isLoading ? <div className="p-4 text-center text-gray-400">Loading...</div> : conversations.map(conv => (
            <div 
              key={conv.id}
              onClick={() => setSelectedConvId(conv.id)}
              className={`p-4 border-b border-gray-50 cursor-pointer transition-colors relative group
                ${selectedConvId === conv.id ? 'bg-teal-50/60 border-l-4 border-l-teal-500' : 'hover:bg-gray-50 border-l-4 border-l-transparent'}
              `}
            >
              <div className="flex justify-between items-start mb-1">
                <span className={`font-semibold text-sm ${selectedConvId === conv.id ? 'text-teal-900' : 'text-slate-700'}`}>
                  {conv.identity?.profile_name || 'Anonymous'}
                </span>
                <span className="text-[10px] text-gray-400">
                  {conv.last_message_at ? new Date(conv.last_message_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                 <span className={`uppercase font-bold text-[10px] px-1 rounded ${conv.identity?.platform === 'line' ? 'text-green-600 bg-green-50' : 'text-blue-600 bg-blue-50'}`}>
                   {conv.identity?.platform}
                 </span>
              </div>

              <div className="flex items-center justify-between mt-2">
                 {conv.ai_mode ? (
                   <span className="flex items-center gap-1 text-[10px] font-medium text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                     <Bot size={10} /> AI Active
                   </span>
                 ) : (
                   <span className="flex items-center gap-1 text-[10px] font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                     <User size={10} /> Human
                   </span>
                 )}
              </div>
            </div>
          ))}
          {!isLoading && conversations.length === 0 && (
             <div className="p-8 text-center text-gray-400 text-sm">No conversations yet.</div>
          )}
        </div>
      </div>

      {/* 2. Chat Area Middle */}
      <div className="flex-1 flex flex-col bg-slate-50 relative">
        {selectedConvId && activeConversation ? (
          <>
            {/* Header */}
            <div className="h-16 px-6 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-lg overflow-hidden">
                   {activeConversation.identity?.avatar_url ? (
                      <img src={activeConversation.identity.avatar_url} className="w-full h-full object-cover"/>
                   ) : (
                      activeConversation.identity?.profile_name?.charAt(0)
                   )}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    {activeConversation.identity?.profile_name}
                    {activeConversation.ai_mode && <Bot size={14} className="text-teal-500" />}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Online
                    <span>via {activeConversation.identity?.platform}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {activeConversation.ai_mode ? (
                  <Button variant="danger" onClick={toggleAIMode} className="gap-2">
                    <XCircle size={16} /> Take Over
                  </Button>
                ) : (
                  <Button variant="primary" onClick={toggleAIMode} className="gap-2">
                    <CheckCircle2 size={16} /> Turn On AI
                  </Button>
                )}
                {/* <Button variant="outline" className="!px-3"><MoreVertical size={16} /></Button> */}
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.map((msg, idx) => {
                const isSystem = msg.sender_type === 'ai' || msg.sender_type === 'agent';
                const isAI = msg.sender_type === 'ai';
                return (
                  <div key={idx} className={`flex ${isSystem ? 'justify-end' : 'justify-start'} group`}>
                    <div className={`flex flex-col max-w-[65%] ${isSystem ? 'items-end' : 'items-start'}`}>
                      <div className={`flex items-end gap-2 ${isSystem ? 'flex-row-reverse' : 'flex-row'}`}>
                         {/* Avatar */}
                         <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] 
                           ${isAI ? 'bg-teal-100 text-teal-700' : 'bg-gray-200 text-gray-500'}
                         `}>
                           {msg.sender_type === 'user' ? <User size={12}/> : isAI ? <Bot size={12}/> : <User size={12}/>}
                         </div>

                         {/* Bubble */}
                         <div className={`px-4 py-3 rounded-2xl text-sm shadow-sm relative ${
                            isSystem 
                              ? (isAI ? 'bg-gradient-to-br from-teal-50 to-white border border-teal-100 text-teal-900 rounded-tr-none' : 'bg-blue-600 text-white rounded-tr-none border border-blue-600') 
                              : 'bg-white text-slate-700 border border-gray-200 rounded-tl-none'
                          }`}>
                            {msg.content}
                         </div>
                      </div>
                      <span className="text-[10px] text-gray-400 mt-1 px-9">
                        {isAI ? 'AI Consultant' : msg.sender_type} • {new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-200">
              <div className="max-w-4xl mx-auto flex gap-3">
                <input 
                  type="text" 
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all text-sm"
                  placeholder={activeConversation.ai_mode ? "⚠️ AI is running. Take over to send message..." : "Type your advice..."}
                  value={currentUserInput}
                  onChange={(e) => setCurrentUserInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  disabled={activeConversation.ai_mode} 
                />
                <Button onClick={handleSendMessage} disabled={activeConversation.ai_mode || !currentUserInput.trim()}>
                  <Send size={18} />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-slate-50/50">
             <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
               <Bot size={40} className="text-gray-300" />
            </div>
            <p className="font-medium">Waiting for incoming messages...</p>
             {conversations.length === 0 && !isLoading && (
              <p className="text-sm mt-2">Try sending a webhook event or manually insert data to test.</p>
            )}
          </div>
        )}
      </div>

      {/* 3. Context Panel Right (Patient Profile) */}
      {selectedConvId && activeConversation && (
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col shadow-sm z-10 overflow-y-auto">
          <div className="p-6 text-center border-b border-gray-100 bg-gradient-to-b from-teal-50/50 to-transparent">
             <div className="w-24 h-24 bg-white p-1 rounded-full mx-auto mb-3 shadow-sm border border-gray-100">
               <div className="w-full h-full bg-slate-100 rounded-full flex items-center justify-center text-3xl text-slate-400 overflow-hidden">
                 {activeConversation.identity?.avatar_url ? (
                    <img src={activeConversation.identity.avatar_url} className="w-full h-full object-cover"/>
                 ) : (
                    activeConversation.identity?.profile_name?.charAt(0)
                 )}
               </div>
             </div>
             <h3 className="font-bold text-lg text-slate-800">{activeConversation.customer?.full_name || activeConversation.identity?.profile_name}</h3>
             <p className="text-sm text-gray-500 flex items-center justify-center gap-1 mt-1">
               <Phone size={12} /> {activeConversation.customer?.phone_number || '-'}
             </p>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <h4 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                <Tag size={12} /> CRM Tags
              </h4>
              <div className="flex flex-wrap gap-2">
                {activeConversation.customer?.crm_tags?.map(tag => (
                  <Badge key={tag} color={tag === 'VIP' ? 'teal' : 'blue'} text={tag} />
                )) || <span className="text-sm text-gray-400 italic">No tags</span>}
              </div>
            </div>

            <div>
              <h4 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                <AlertCircle size={12} /> Skin Concerns
              </h4>
              <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
                <ul className="list-disc list-inside text-sm text-orange-800 space-y-1">
                   {activeConversation.customer?.skin_concerns?.map((concern, i) => (
                     <li key={i}>{concern}</li>
                   ))}
                </ul>
                {(!activeConversation.customer?.skin_concerns || activeConversation.customer?.skin_concerns.length === 0) && (
                   <span className="text-sm text-gray-400 italic">None recorded</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
