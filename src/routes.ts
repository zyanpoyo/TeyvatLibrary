import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/shelf.tsx"),
  route("courses", "routes/courses.tsx"),
  route("courses/:courseId", "routes/course-detail.tsx"),
  route("story/:storyId", "routes/story.tsx"),
  route("about", "routes/about.tsx"),
  route("404", "routes/not-found.tsx"),
  route("*", "routes/not-found.tsx", { id: "routes/catch-all" }),
] satisfies RouteConfig;
