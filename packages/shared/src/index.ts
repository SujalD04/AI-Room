// ─── User ───
export interface User {
    id: string;
    username: string;
    email: string;
    nickname?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
    createdAt: string;
}

// ─── Room ───
export type RoomRole = 'HOST' | 'MEMBER';

export interface RoomSettings {
    defaultModel?: string;
    theme?: 'dark' | 'light';
    maxMembers?: number;
}

export interface Room {
    id: string;
    name: string;
    slug: string;
    hostId: string;
    maxMembers: number;
    isActive: boolean;
    settings: RoomSettings;
    createdAt: string;
}

export interface RoomMember {
    id: string;
    roomId: string;
    userId: string;
    user: User;
    role: RoomRole;
    joinedAt: string;
}

// ─── API Keys (BYOK) ───
export type LLMProvider =
    | 'openrouter'
    | 'groq'
    | 'gemini'
    | 'openai'
    | 'anthropic'
    | 'deepseek'
    | 'together';

export interface ApiKeyInfo {
    id: string;
    provider: LLMProvider;
    label: string;
    createdAt: string;
    // Never expose the actual key to the client
}

// ─── Conversation DAG ───
export type AuthorType = 'USER' | 'AI' | 'SYSTEM';
export type EdgeType = 'REPLY' | 'BRANCH' | 'MERGE';

export interface ConversationThread {
    id: string;
    roomId: string;
    creatorId?: string | null;
    title: string;
    modelConfig: ModelConfig;
    createdAt: string;
}

export interface ModelConfig {
    modelId: string;
    provider: LLMProvider;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
}

export interface MessageNode {
    id: string;
    threadId: string;
    parentId: string | null;
    authorType: AuthorType;
    authorId: string | null;
    authorName?: string;
    modelId: string | null;
    content: string;
    metadata: MessageMetadata;
    createdAt: string;
    children?: MessageNode[];
}

export interface MessageMetadata {
    tokensUsed?: number;
    latencyMs?: number;
    branchLabel?: string;
    isCouncilResponse?: boolean;
    councilDetails?: CouncilDetails;
}

// ─── AI Council ───
export interface CouncilConfig {
    models: ModelConfig[];
    aggregatorModel: ModelConfig;
    maxDebateRounds: number;
    consensusThreshold: number; // 0-1 agreement score
}

export interface CouncilDetails {
    individualResponses: CouncilIndividualResponse[];
    consensusScore: number;
    debateRounds: number;
    aggregatorModel: string;
}

export interface CouncilIndividualResponse {
    modelId: string;
    provider: LLMProvider;
    response: string;
    latencyMs: number;
}

// ─── Notes ───
export type NoteType = 'NOTE' | 'TODO_LIST';

export interface Note {
    id: string;
    roomId: string;
    authorId: string;
    authorName?: string;
    title: string;
    content: any; // TipTap JSON
    type: NoteType;
    isPinned: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface TodoItem {
    id: string;
    noteId: string;
    text: string;
    isCompleted: boolean;
    assigneeId?: string;
    assigneeName?: string;
    order: number;
}

// ─── Socket Events ───
export interface ServerToClientEvents {
    // Room
    'room:member_joined': (member: RoomMember) => void;
    'room:member_left': (data: { userId: string }) => void;
    'room:presence': (data: PresenceData) => void;
    'room:typing': (data: { userId: string; username: string; isTyping: boolean }) => void;
    'room:thread_created': (data: { thread: ConversationThread }) => void;
    'room:thread_deleted': (data: { threadId: string }) => void;

    // Chat
    'chat:message': (message: MessageNode) => void;
    'chat:stream_start': (data: { messageId: string; threadId: string; modelId: string }) => void;
    'chat:stream_token': (data: { messageId: string; token: string }) => void;
    'chat:stream_end': (data: { messageId: string; metadata: MessageMetadata }) => void;
    'chat:stream_error': (data: { messageId: string; error: string }) => void;

    // Council
    'council:started': (data: { queryId: string; models: string[] }) => void;
    'council:individual_response': (data: { queryId: string; response: CouncilIndividualResponse }) => void;
    'council:aggregation_start': (data: { queryId: string }) => void;
    'council:stream_token': (data: { queryId: string; token: string }) => void;
    'council:complete': (data: { queryId: string; message: MessageNode }) => void;
    'council:error': (data: { queryId: string; error: string }) => void;

    // Notes
    'notes:updated': (note: Note) => void;
    'notes:deleted': (data: { noteId: string }) => void;
    'notes:todo_toggled': (data: { noteId: string; todoId: string; isCompleted: boolean }) => void;

    // Media (WebRTC via mediasoup)
    'media:newProducer': (data: { producerId: string; peerId: string; kind: string; appData?: any }) => void;
    'media:producerClosed': (data: { producerId: string; peerId: string }) => void;
    'media:producerPaused': (data: { producerId: string; peerId: string }) => void;
    'media:producerResumed': (data: { producerId: string; peerId: string }) => void;

    // Errors
    'error': (data: { message: string; code?: string }) => void;
}

export interface ClientToServerEvents {
    // Room
    'room:join': (data: { roomSlug: string }, callback: (response: JoinRoomResponse) => void) => void;
    'room:leave': () => void;
    'room:typing': (data: { isTyping: boolean }) => void;

    // Chat
    'chat:send_message': (data: SendMessagePayload, callback: (response: SendMessageResponse) => void) => void;
    'chat:branch_message': (data: BranchMessagePayload, callback: (response: SendMessageResponse) => void) => void;

    // Council
    'council:query': (data: CouncilQueryPayload, callback: (response: { queryId: string }) => void) => void;

    // Notes
    'notes:create': (data: CreateNotePayload, callback: (response: { note: Note }) => void) => void;
    'notes:update': (data: UpdateNotePayload, callback: (response: { note: Note }) => void) => void;
    'notes:delete': (data: { noteId: string }, callback: (response: { success: boolean }) => void) => void;
    'notes:toggle_todo': (data: { noteId: string; todoId: string }, callback: (response: { success: boolean }) => void) => void;
}

// ─── Payload Types ───
export interface SendMessagePayload {
    threadId: string;
    parentId: string | null;
    content: string;
    requestAiResponse?: boolean;
}

export interface BranchMessagePayload {
    threadId: string;
    branchFromMessageId: string;
    content: string;
    branchLabel?: string;
    modelConfig?: ModelConfig;
}

export interface CouncilQueryPayload {
    threadId: string;
    parentId: string | null;
    content: string;
    councilConfig: CouncilConfig;
}

export interface CreateNotePayload {
    title: string;
    content: any;
    type: NoteType;
}

export interface UpdateNotePayload {
    noteId: string;
    title?: string;
    content?: any;
    isPinned?: boolean;
}

export interface JoinRoomResponse {
    success: boolean;
    room?: Room;
    members?: RoomMember[];
    threads?: ConversationThread[];
    notes?: Note[];
    error?: string;
}

export interface SendMessageResponse {
    success: boolean;
    message?: MessageNode;
    error?: string;
}

// ─── Presence ───
export interface PresenceData {
    onlineUserIds: string[];
    memberCount: number;
}
