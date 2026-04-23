import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "data", "projects.json");

function getProjects() {
    if (!fs.existsSync(DATA_PATH)) {
        return [];
    }
    const data = fs.readFileSync(DATA_PATH, "utf8");
    return JSON.parse(data);
}

function saveProjects(projects: any[]) {
    const dir = path.dirname(DATA_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_PATH, JSON.stringify(projects, null, 4), "utf8");
}

export async function GET() {
    try {
        const projects = getProjects();
        return NextResponse.json(projects);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const project = await req.json();
        const projects = getProjects();
        projects.push(project);
        saveProjects(projects);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to save project" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, updates } = body;
        let projects = getProjects();
        projects = projects.map((p: any) => p.id === id ? { ...p, ...updates } : p);
        saveProjects(projects);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

        let projects = getProjects();
        projects = projects.filter((p: any) => p.id !== Number(id) && p.id !== id);
        saveProjects(projects);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
    }
}
