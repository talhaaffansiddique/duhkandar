export default function SortHeader({
  label,
  sortKey,
  headerProps,
  num,
}: {
  label: string;
  sortKey: string;
  headerProps: (key: string) => { className: string; onClick: () => void };
  num?: boolean;
}) {
  const props = headerProps(sortKey);
  return (
    <th className={props.className + (num ? " num" : "")} onClick={props.onClick}>
      {label}
      <span className="arrow">▲▼</span>
    </th>
  );
}
