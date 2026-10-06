interface FilterDropdownProps {
  value: string
  onChange: (value: string) => void
  options: string[]
  label?: string
}

export function FilterDropdown({ value, onChange, options, label = 'All' }: FilterDropdownProps) {
  return (
    <select
      className="form-select filter-select"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
    >
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}
