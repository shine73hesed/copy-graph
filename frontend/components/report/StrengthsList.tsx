'use client';

interface Props {
  items: string[];
}

export default function StrengthsList({ items }: Props) {
  if (!items.length) return null;

  return (
    <ul className="report-list">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
