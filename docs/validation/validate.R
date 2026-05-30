# Independent validation of the Dedoose IRR tool's kappa math against R's
# `irr` package, computed on the exact same coverage matrices the JS uses.
#
# Setup:
#   node docs/validation/export_for_r.mjs   # writes the CSVs next to this file
#   Rscript docs/validation/validate.R      # needs install.packages("irr")
#
# The script prints this tool's kappa, R's kappa, and the absolute difference
# for every code. Differences should be ~0 (well under 1e-9).

suppressMessages(library(irr))

here <- tryCatch(dirname(sys.frame(1)$ofile), error = function(e) ".")
read_here <- function(f) read.csv(file.path(here, f), stringsAsFactors = FALSE,
                                  check.names = FALSE)

cov_ab  <- read_here("coverage_ab.csv")
cov_abc <- read_here("coverage_abc.csv")
expected <- read_here("expected.csv")

exp_lookup <- setNames(expected$kappa, expected$code)

cohen_kappa <- function(df) {
  # df has columns: code, A, B (already subset to one code)
  k <- kappa2(cbind(df$A, df$B))$value
  k
}

fleiss_kappa <- function(df) {
  kappam.fleiss(cbind(df$A, df$B, df$C))$value
}

cat("=== Two coders: Cohen's kappa (irr::kappa2) ===\n")
cat(sprintf("%-26s %12s %12s %12s\n", "code", "tool", "R", "abs diff"))

codes <- unique(cov_ab$code)
pooled_A <- c(); pooled_B <- c()

for (code in codes) {
  sub <- cov_ab[cov_ab$code == code, ]
  pooled_A <- c(pooled_A, sub$A)
  pooled_B <- c(pooled_B, sub$B)

  r_k <- tryCatch(cohen_kappa(sub), error = function(e) NA)
  tool_k <- suppressWarnings(as.numeric(exp_lookup[[code]]))

  diff <- if (is.na(r_k) || is.na(tool_k)) NA else abs(r_k - tool_k)
  cat(sprintf("%-26s %12s %12s %12s\n",
              code,
              ifelse(is.na(tool_k), "NA", sprintf("%.6f", tool_k)),
              ifelse(is.na(r_k), "NA", sprintf("%.6f", r_k)),
              ifelse(is.na(diff), "(no var)", sprintf("%.2e", diff))))
}

pooled_r <- kappa2(cbind(pooled_A, pooled_B))$value
pooled_tool <- suppressWarnings(as.numeric(exp_lookup[["POOLED"]]))
cat(sprintf("%-26s %12s %12s %12s\n", "POOLED",
            sprintf("%.6f", pooled_tool),
            sprintf("%.6f", pooled_r),
            sprintf("%.2e", abs(pooled_r - pooled_tool))))

cat("\n=== Three coders: Fleiss' kappa (irr::kappam.fleiss) ===\n")
cat(sprintf("%-26s %12s\n", "code", "R"))
for (code in unique(cov_abc$code)) {
  sub <- cov_abc[cov_abc$code == code, ]
  r_k <- tryCatch(fleiss_kappa(sub), error = function(e) NA)
  cat(sprintf("%-26s %12s\n", code, ifelse(is.na(r_k), "NA", sprintf("%.6f", r_k))))
}

cat("\nIf the abs-diff column is ~0 everywhere, the tool matches R.\n")
cat("Codes with no variance (e.g. Market saturation) are undefined in both.\n")
