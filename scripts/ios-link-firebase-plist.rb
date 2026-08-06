# Add GoogleService-Info.plist to the App target's Resources phase.
#
# WHY THIS EXISTS. The plist is gitignored and account-gated, and it is NOT
# referenced in project.pbxproj — SHIP-CHECKLIST §2 says to "add to the App
# target in Xcode", which means dragging it in, which is exactly the step a
# machine with no Xcode cannot perform. Without the reference the file sits
# in ios/App/App/ and never reaches the bundle, so
# `Bundle.main.path(forResource: "GoogleService-Info", ...)` returns nil,
# AppDelegate skips FirebaseApp.configure(), and the shipped app has no
# Firebase at all. It builds, signs, uploads and installs; it just cannot
# talk to the backend.
#
# WHY THE REFERENCE IS NOT SIMPLY COMMITTED. A PBXFileReference to a file
# that is not on disk is a hard build error ("Build input file cannot be
# found"), and the file is absent by design on every checkout — including
# ios-build.yml's simulator job, which additionally ASSERTS the plist is
# absent from the built bundle so a committed secret cannot go unnoticed.
# Committing the reference would break that job to fix this one. So the
# link is made at release time, on a runner that has the secret, and never
# lands in the tree.
#
# WHY RUBY, in a repo whose scripts are Node-stdlib-only. That convention
# exists for scripts on the DEPLOY path, where a dependency is a liability.
# This one runs on a macOS runner that already has Ruby, and `xcodeproj` is
# the reference implementation of pbxproj editing. Hand-rolling UUID
# generation and four coordinated insertions in regex would be a fragile
# script guarding a step whose failure is silent — the wrong trade.
#
# Idempotent: re-running finds the existing reference and does nothing.

require "xcodeproj"

project_path = ARGV[0] || "ios/App/App.xcodeproj"
plist_name = "GoogleService-Info.plist"
plist_path = File.join(File.dirname(project_path), "App", plist_name)

unless File.exist?(plist_path)
  abort("ios-link-firebase-plist: #{plist_path} is not on disk.\n" \
        "    Write it from the GOOGLE_SERVICE_INFO_PLIST secret before running this.")
end

project = Xcodeproj::Project.open(project_path)
target = project.targets.find { |t| t.name == "App" }
abort("ios-link-firebase-plist: no target named App in #{project_path}") if target.nil?

already = target.resources_build_phase.files.any? do |bf|
  bf.file_ref && bf.file_ref.path && File.basename(bf.file_ref.path) == plist_name
end

if already
  puts "ios-link-firebase-plist: #{plist_name} already in the App target — nothing to do."
  exit 0
end

group = project.main_group.find_subpath("App", true)
group.set_source_tree("SOURCE_ROOT") if group.source_tree.nil?
file_ref = group.new_reference(plist_name)
target.resources_build_phase.add_file_reference(file_ref)
project.save

puts "ios-link-firebase-plist: added #{plist_name} to the App target's Resources phase."
