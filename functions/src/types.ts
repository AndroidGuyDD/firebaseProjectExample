export interface DBUser {
    id?: string,
    name: string,
    email: string,
    topChatRooms: [],
    registerDate: number,
    isAdmin: boolean,
    fcmToken: string
}

export interface MembershipRequest {
    id: string,
    userId: string,
    roomName: string
}

export interface AdminRequestBody {
    userId: string,
    isAdmin: boolean
}