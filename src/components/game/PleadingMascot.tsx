interface PleadingMascotProps {
  pleadingText: string;
}

export function PleadingMascot({ pleadingText }: PleadingMascotProps) {
  return (
    <div className="tapko-pleading-mascot" aria-hidden="true">
      <div className="tapko-pleading-bubble" role="status">
        {pleadingText}
      </div>
      <div className="tapko-pleading-sprite" />
    </div>
  );
}
