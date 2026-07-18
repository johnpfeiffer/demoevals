import { Link, Typography } from '@mui/material'
import GitHubIcon from '@mui/icons-material/GitHub'
import LinkedInIcon from '@mui/icons-material/LinkedIn'

export default function Footer() {
  return (
    <Typography variant="body2">
      Built by John Pfeiffer{" "}
      <Link
        href="https://www.linkedin.com/in/foupfeiffer"
        target="_blank"
        rel="noopener noreferrer"
        color="inherit"
        underline="hover"
        aria-label="John Pfeiffer on LinkedIn"
        sx={{ display: "inline-flex", verticalAlign: "text-bottom" }}
      >
        <LinkedInIcon />
      </Link>
      {" "}
      <Link
        href="https://github.com/johnpfeiffer/aiewf"
        target="_blank"
        rel="noopener noreferrer"
        color="inherit"
        underline="hover"
        aria-label="Source code on GitHub"
        sx={{ display: "inline-flex", verticalAlign: "text-bottom" }}
      >
        <GitHubIcon />
      </Link>
    </Typography>
  )
}
