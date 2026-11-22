import { Link, useParams } from "react-router";
import type { Route } from "./+types/course-detail";
import { fetchStoriesIndex } from "../api/stories";
import { CourseDetailPage } from "../components/courses/CourseDetailPage";
import { buildCourseDetailMeta } from "../domain/seo";
import { loadDistCourseDetail } from "../server/dist-data.server.mjs";
import commonStyles from "../styles/common.module.css";

export function loader({ params }: Route.LoaderArgs) {
  const result = loadDistCourseDetail(params.courseId);
  return {
    course: result?.course ?? null,
    indexData: result?.indexData ?? null,
    notFound: !result,
  };
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const courseId = params.courseId ?? "";
  if (!courseId) {
    return {
      course: null,
      indexData: null,
      notFound: true,
    };
  }

  try {
    const indexData = await fetchStoriesIndex();
    const course = (indexData.courses ?? []).find((c) => c.id === courseId) ?? null;
    return {
      course,
      indexData,
      notFound: !course,
    };
  } catch {
    return {
      course: null,
      indexData: null,
      notFound: false,
    };
  }
}

export function meta({ loaderData }: Route.MetaArgs) {
  return buildCourseDetailMeta({
    course: loaderData?.course ?? null,
    indexData: loaderData?.indexData ?? null,
  });
}

export default function CourseDetailRoute({ loaderData }: Route.ComponentProps) {
  const { courseId = "" } = useParams<{ courseId: string }>();

  if (loaderData.notFound) {
    return (
      <section className={commonStyles.emptyState}>
        <h1 className={commonStyles.emptyTitle}>読書コースが見つかりません</h1>
        <p className={commonStyles.emptyDesc}>
          指定された読書コースは見つかりませんでした。URL を確認するか、読書コース一覧からお探しください。
        </p>
        <Link to="/courses" className={commonStyles.controlPill}>
          ← 読書コース一覧へ戻る
        </Link>
      </section>
    );
  }

  return (
    <CourseDetailPage
      courseId={courseId}
      initialCourse={loaderData.course}
      initialIndexData={loaderData.indexData}
    />
  );
}
