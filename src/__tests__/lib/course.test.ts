import { transformMilestonesToModules, transformCourseToModules } from "../../lib/course";

describe("course utils", () => {
    describe("transformMilestonesToModules - guards", () => {
        it("returns [] when milestones is falsy or not an array", () => {
            expect(transformMilestonesToModules(undefined as unknown as any[])).toEqual([]);
            expect(transformMilestonesToModules(null as unknown as any[])).toEqual([]);
            expect(transformMilestonesToModules({} as unknown as any[])).toEqual([]);
        });
    });

    describe("transformMilestonesToModules - assignment branch", () => {
        it("maps assignment tasks to module items with correct fields", () => {
            const milestones = [
                {
                    id: 1,
                    name: "M1",
                    ordering: 2,
                    color: "#112233",
                    unlock_at: "2025-10-17T00:00:00.000Z",
                    tasks: [
                        {
                            id: 300,
                            title: "Assignment A",
                            ordering: 3,
                            type: "assignment",
                            status: "draft",
                            scheduled_publish_at: "2025-10-20T12:00:00.000Z",
                            is_generating: false
                        }
                    ]
                }
            ] as unknown as any[];

            const modules = transformMilestonesToModules(milestones as any);
            expect(modules).toHaveLength(1);
            const module = modules[0];
            expect(module.items).toHaveLength(1);
            const item = module.items[0] as any;
            expect(item).toMatchObject({
                id: "300",
                title: "Assignment A",
                position: 3,
                type: "assignment",
                status: "draft",
                scheduled_publish_at: "2025-10-20T12:00:00.000Z",
                isGenerating: false
            });
        });
    });

    describe("transformMilestonesToModules - learning material, quiz and sorting", () => {
        it("maps learning_material and quiz, sorts items and modules by position", () => {
            const milestones = [
                {
                    id: 10,
                    name: "M-A",
                    ordering: 2,
                    color: "#ABCDEF",
                    unlock_at: "2025-10-18T00:00:00.000Z",
                    tasks: [
                        { id: 2, title: "Q2", ordering: 2, type: "quiz", status: "published", questions: [{ id: 1 }], num_questions: 5, scheduled_publish_at: null as unknown as string, is_generating: true },
                        { id: 1, title: "LM1", ordering: 1, type: "learning_material", status: "draft", content: [{ text: "a" }], scheduled_publish_at: "2025-10-19T10:00:00.000Z", is_generating: false }
                    ]
                },
                {
                    id: 9,
                    name: "M-B",
                    ordering: 1,
                    color: "#000000",
                    unlock_at: null,
                    tasks: []
                }
            ] as unknown as any[];

            const modules = transformMilestonesToModules(milestones as any);

            // modules sorted by ordering => id 9 (ordering 1) first
            expect(modules.map(m => m.id)).toEqual(["9", "10"]);

            // Items sorted by position: LM1(ordering1), Q2(ordering2)
            const items = modules[1].items as any[];
            expect(items.map(i => i.title)).toEqual(["LM1", "Q2"]);
            expect(items[0]).toMatchObject({ id: "1", type: "material", position: 1, status: "draft", scheduled_publish_at: "2025-10-19T10:00:00.000Z", isGenerating: false });
            expect(items[1]).toMatchObject({ id: "2", type: "quiz", position: 2, status: "published", numQuestions: 5, isGenerating: true });
        });
    });

    describe("transformCourseToModules passthrough", () => {
        it("returns [] for null/undefined course", () => {
            expect(transformCourseToModules(null)).toEqual([]);
            expect(transformCourseToModules(undefined)).toEqual([]);
        });

        it("delegates to transformMilestonesToModules for provided course", () => {
            const course = { milestones: [] } as any;
            const modules = transformCourseToModules(course);
            expect(Array.isArray(modules)).toBe(true);
        });
    });
});


