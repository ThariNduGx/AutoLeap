"use client"

import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import {
    LayoutDashboard,
    MessageSquare,
    BookOpen,
    Calendar,
    Settings,
    LogOut,
} from "lucide-react"
import Link from "next/link"

const sidebarItems = [
    {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
    },
    {
        title: "Conversations",
        href: "/dashboard/conversations",
        icon: MessageSquare,
    },
    {
        title: "Knowledge Base",
        href: "/dashboard/knowledge",
        icon: BookOpen,
    },
    {
        title: "Calendar",
        href: "/dashboard/calendar",
        icon: Calendar,
    },
    {
        title: "Settings",
        href: "/dashboard/settings",
        icon: Settings,
    },
]

export function Sidebar() {
    return (
        <div className="hidden bg-muted/40 lg:block dark:bg-zinc-950 min-h-screen">
            <div className="flex h-full max-h-screen flex-col gap-2">
                <div className="flex h-14 items-center px-6 lg:h-[60px]">
                    <Link className="flex items-center gap-2 font-semibold" href="/">
                        <div className="h-6 w-6 rounded-lg bg-primary flex items-center justify-center">
                            <span className="text-primary-foreground font-bold text-xs">A</span>
                        </div>
                        <span className="">AutoLeap</span>
                    </Link>
                </div>
                <div className="flex-1 overflow-auto py-2">
                    <div className="grid items-start px-4 text-sm font-medium">
                        <SidebarNav items={sidebarItems} />
                    </div>
                </div>
                <div className="mt-auto p-4">
                    {/* Bottom items can go here */}
                </div>
            </div>
        </div>
    )
}
