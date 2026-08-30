import { Block, SkeletonRows } from "../Skeleton";

export default function TripsLoading() {
  return (
    <div style={{ padding: "20px 24px", maxWidth: 860 }} aria-busy="true" aria-label="Loading trips">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
        <Block w={84} h={30} />
        <Block w={190} h={9} />
      </div>
      <SkeletonRows count={5} />
    </div>
  );
}
