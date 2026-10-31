import { sourceStyles } from "@/styles/source.styles";
import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { SectionTitle } from "@/components/app/shared";

export function OpensourceScreen() {
  return (
    <div
      className={cn(
        sourceStyles.opensourceView,
        sharedStyles.scrollContent,
        sourceStyles.osDiscoverySections,
      )}
    >
      <p className={sourceStyles.osDiscoveryEmpty} role="status">
        현재 오픈소스 목록을 사용할 수 없습니다.
      </p>
      <section aria-label="오픈소스 인기 차트">
        <SectionTitle>인기 차트</SectionTitle>
        <p className={sourceStyles.osDiscoveryEmpty}>아직 표시할 오픈소스가 없습니다.</p>
      </section>
      <section aria-label="추천 오픈소스">
        <SectionTitle>추천 오픈소스</SectionTitle>
        <p className={sourceStyles.osDiscoveryEmpty}>아직 추천할 오픈소스가 없습니다.</p>
      </section>
    </div>
  );
}

export function OpensourceDetailScreen() {
  return (
    <p className={sourceStyles.osDiscoveryEmpty} role="status">
      현재 오픈소스 상세 정보를 사용할 수 없습니다.
    </p>
  );
}
