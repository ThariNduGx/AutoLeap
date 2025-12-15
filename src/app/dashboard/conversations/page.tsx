"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Send, Search, MoreVertical } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function ConversationsPage() {
    return (
        <div className="grid h-[calc(100vh-140px)] lg:h-[calc(100vh-120px)] grid-cols-1 md:grid-cols-4 gap-6">
            {/* Chat List */}
            <div className="col-span-1 flex flex-col rounded-xl bg-card text-card-foreground shadow-sm overflow-hidden">
                <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold">Messages</h2>
                        <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search..." className="pl-8 bg-muted/50 border-none" />
                    </div>
                </div>
                <div className="flex-1 overflow-auto p-2 space-y-1">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                            <Avatar>
                                <AvatarImage src={`/avatars/0${i}.png`} />
                                <AvatarFallback>JD</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 overflow-hidden">
                                <div className="flex justify-between items-baseline mb-1">
                                    <span className="font-semibold text-sm">Alice Smith</span>
                                    <span className="text-xs text-muted-foreground">10:23 AM</span>
                                </div>
                                <p className="text-xs text-muted-foreground truncate font-medium">
                                    Can you reschedule my appointment to next Tuesday?
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Chat Window */}
            <div className="col-span-3 flex flex-col rounded-xl bg-card text-card-foreground shadow-sm overflow-hidden">
                {/* Header */}
                <div className="p-4 flex flex-row items-center justify-between bg-muted/20">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                            <AvatarImage src="/avatars/01.png" />
                            <AvatarFallback>AS</AvatarFallback>
                        </Avatar>
                        <div>
                            <div className="font-semibold text-sm">Alice Smith</div>
                            <div className="text-xs text-green-500 font-medium flex items-center gap-1">
                                <span className="block h-2 w-2 rounded-full bg-green-500" />
                                Online
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="hidden sm:flex">View Profile</Button>
                        <Button variant="default" size="sm">Create Ticket</Button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-auto p-6 space-y-6 bg-muted/5">
                    <div className="flex justify-start">
                        <div className="flex gap-2 max-w-[80%]">
                            <Avatar className="h-8 w-8 mt-1">
                                <AvatarFallback>AS</AvatarFallback>
                            </Avatar>
                            <div className="bg-muted px-4 py-2 rounded-2xl rounded-tl-none">
                                <p className="text-sm">Hi, I'd like to book a cleaning service for my office.</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <div className="flex gap-2 max-w-[80%] flex-row-reverse">
                            <Avatar className="h-8 w-8 mt-1">
                                <AvatarFallback>You</AvatarFallback>
                            </Avatar>
                            <div className="bg-primary text-primary-foreground px-4 py-2 rounded-2xl rounded-tr-none">
                                <p className="text-sm">Hello! I'd be happy to help with that. What is the square footage of the office?</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-start">
                        <div className="flex gap-2 max-w-[80%]">
                            <Avatar className="h-8 w-8 mt-1">
                                <AvatarFallback>AS</AvatarFallback>
                            </Avatar>
                            <div className="bg-muted px-4 py-2 rounded-2xl rounded-tl-none">
                                <p className="text-sm">It's about 2000 sq ft. We need a deep clean.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Input Area */}
                <div className="p-4 bg-background">
                    <div className="flex gap-2 items-center bg-muted/30 p-2 rounded-xl border border-transparent focus-within:border-primary/20 transition-all">
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                            <MoreVertical className="h-5 w-5 rotate-90" />
                        </Button>
                        <Input
                            placeholder="Type your message..."
                            className="border-none shadow-none focus-visible:ring-0 bg-transparent flex-1"
                        />
                        <Button size="icon" className="rounded-lg shadow-sm">
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
